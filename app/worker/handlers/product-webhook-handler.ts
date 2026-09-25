import type { ProductVariant } from "~/@types/productVariant";
import type { Shop } from "~/@types/shop";
import { updateProductVariants } from "~/api/update-product-variants";
import { deleteProductVariants } from "~/api/delete-product-variants";
import { deleteProductVariantService } from "~/services/delete-product-variant.service";
import {
  markProductVariantSyncResults,
  refreshProductVariantSyncLog,
} from "~/services/refresh-product-variant-sync-log.server";
import { updateMarketFromWebhook } from "~/services/update-market-from-webhook.server";
import type { ProductWebhookJobData } from "~/services/queue";
import {
  productVariantSyncRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import { createClient } from "../services/create-client";
import { createProductVariantPayload } from "../services/create-product-variant-payload";
import { fetchAllProductVariants } from "../services/get-product-variants";
import { getProductById } from "../services/get-products";
import { getShopPrimaryLocale } from "../services/get-shop-primary-locale";
import { getShopSecondaryLocales } from "../services/get-shop-locales";
import { getProductTranslations } from "../services/get-product-translations";
import { getOfflineAccessToken } from "~/services/get-offline-session.server";

export class ProductNotReadyError extends Error {
  constructor(productGid: string) {
    super(`Product ${productGid} is not readable from Shopify yet`);
    this.name = "ProductNotReadyError";
  }
}

/**
 * Processes one debounced product webhook.
 *
 * Create and update both load the product from the Admin API at run time,
 * so the payload includes the image and collections Shopify attaches after
 * the first products/create. Delete still uses the id from the job, because
 * the product is already gone.
 */
export async function productWebhookHandler(
  data: ProductWebhookJobData,
): Promise<void> {
  const shopData = await shopRepository.getShop(data.shop);
  if (!shopData?.apiKey || !shopData.isProductVariantSyncEnabled) {
    console.log(
      `[product-webhook] skip ${data.topic} ${data.productGid} for ${data.shop}: sync disabled or api key missing`,
    );
    return;
  }

  console.log(
    `[product-webhook] ${data.topic} ${data.productGid} for ${data.shop}`,
  );

  if (data.topic === "PRODUCTS_DELETE") {
    const numericProductId = data.productGid.split("/").pop();
    await deleteProductVariantService(
      { id: numericProductId },
      shopData.apiKey,
      shopData.id,
      shopData.domain || data.shop,
      shopData.orgId,
      shopData.siteId,
    );
    return;
  }

  await syncProductFromAdmin(data, shopData);
}

async function syncProductFromAdmin(
  data: ProductWebhookJobData,
  shopData: Shop,
): Promise<void> {
  const accessToken = await getOfflineAccessToken(data.shop);
  if (!accessToken) {
    throw new Error(
      `Product webhook: no valid offline session for ${data.shop}`,
    );
  }

  const apiKey = shopData.apiKey;
  if (!apiKey) return;

  const client = createClient({ shop: data.shop, accessToken });
  const { product, shopCurrency } = await getProductById({
    client,
    productId: data.productGid,
  });

  if (!product) {
    throw new ProductNotReadyError(data.productGid);
  }

  const storedLanguageCode = shopData.defaultLanguageCode ?? null;
  const currentLocale = await getShopPrimaryLocale({ client });
  const languageCode = currentLocale ?? storedLanguageCode ?? "en";
  const resolvedCurrency = shopCurrency ?? shopData.defaultCurrency ?? "";

  if (languageCode !== storedLanguageCode) {
    await shopRepository.updateShop(data.shop, {
      defaultLanguageCode: languageCode,
      ...(resolvedCurrency ? { defaultCurrency: resolvedCurrency } : {}),
    });
  }

  const secondaryLocales = await getShopSecondaryLocales({
    client,
    primaryLocale: languageCode,
  });

  const variants = await fetchAllProductVariants({ client, product });
  const shopDomain = shopData.domain || data.shop;

  const variantIds = variants.map((variant) => variant.id);
  const existingSyncs =
    variantIds.length > 0
      ? await productVariantSyncRepository.getProductVariantSyncByVariantIds(
          variantIds,
        )
      : [];
  const syncByVariantId = new Map(
    existingSyncs.map((row) => [row.variantId, row]),
  );

  const productVariantsData: ProductVariant[] = [];

  if (secondaryLocales.length > 0 && variants.length > 0) {
    const translations = await getProductTranslations({
      client,
      productId: product.id,
      variantGids: variantIds,
      locales: secondaryLocales,
      shopDomain: data.shop,
      productHandle: product.handle,
      collections: (product.collections?.nodes ?? []).map((node) => ({
        id: node.id,
        name: node.title,
      })),
    });
    if (Object.keys(translations.product).length > 0) {
      product.translations = translations.product;
    }
    if (Object.keys(translations.variants).length > 0) {
      product.variantTranslations = translations.variants;
    }
  }

  try {
    for (const variant of variants) {
      const existing = syncByVariantId.get(variant.id);
      const entityUpdatedDate = Math.max(
        new Date(variant.updatedAt).getTime() || 0,
        new Date(product.updatedAt).getTime() || 0,
      );
      const syncUpdatedDate = existing?.updatedAt?.getTime() ?? 0;
      const shouldSend =
        !existing || existing.syncFailed || entityUpdatedDate > syncUpdatedDate;

      if (!shouldSend) continue;

      const action = existing ? "update" : "create";
      const payload = createProductVariantPayload(
        product,
        variant,
        resolvedCurrency,
        shopDomain,
        action,
        existing?.syncedTagKeys ?? [],
      );
      productVariantsData.push(payload);

      await productVariantSyncRepository.createOrUpdateProductVariantSync({
        variantId: variant.id,
        productId: product.id,
        syncedTagKeys: Object.keys(payload.tags ?? {}),
        // Stay failed until Yespo accepts. A thrown request then retries,
        // because a successful row with a newer updatedAt would be skipped.
        syncFailed: true,
        createdAt: variant.createdAt ?? product.createdAt,
        updatedAt: new Date(entityUpdatedDate),
        shop: { connect: { id: shopData.id } },
      });
    }

    if (productVariantsData.length > 0) {
      const response = await updateProductVariants({
        apiKey,
        siteId: shopData.siteId ?? "",
        languageCode,
        productVariants: productVariantsData,
        domain: data.shop,
        orgId: shopData.orgId,
      });

      await markProductVariantSyncResults(
        shopData.id,
        productVariantsData.map((variant) => variant.productId),
        response?.failedVariants,
      );
    }

    const trackedVariantGids =
      await productVariantSyncRepository.getVariantIdsByProductId(
        shopData.id,
        product.id,
      );
    const presentVariantGids = new Set(variants.map((variant) => variant.id));
    const orphanedVariantGids = trackedVariantGids.filter(
      (gid) => !presentVariantGids.has(gid),
    );

    if (orphanedVariantGids.length > 0 && shopData.siteId) {
      await deleteProductVariants({
        apiKey,
        siteId: shopData.siteId,
        externalVariantIds: orphanedVariantGids.map(
          (gid) => gid.split("/").pop() ?? gid,
        ),
        domain: data.shop,
        orgId: shopData.orgId,
      });
      await productVariantSyncRepository.deleteByVariantIds(
        shopData.id,
        orphanedVariantGids,
      );
    }

    await updateMarketFromWebhook({
      shopId: shopData.id,
      shopifyDomain: data.shop,
      accessToken,
      productGid: product.id,
      isMarketSyncEnabled: shopData.isMarketSyncEnabled ?? false,
      apiKey,
      siteId: shopData.siteId ?? "",
      domain: shopData.domain || data.shop,
      orgId: shopData.orgId,
    });
  } finally {
    await refreshProductVariantSyncLog(shopData.id);
  }
}
