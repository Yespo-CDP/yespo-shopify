import {
  updateProductVariants,
  stripCategoryIdsFromProduct,
} from "~/api/update-product-variants";
import { deleteProductVariants } from "~/api/delete-product-variants";
import {
  productVariantSyncRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import {
  createProductVariantPayloadFromWebhook,
  type ProductVariantWebhookPayload,
} from "./create-product-variant-payload-from-webhook";
import { createClient } from "~/worker/services/create-client";
import { getProductCollectionsAndCategories } from "~/worker/services/get-product-collections-and-categories";
import { fetchAllProductVariantGids } from "~/worker/services/get-product-variants";
import { getShopSecondaryLocales } from "~/worker/services/get-shop-locales";
import { getProductTranslations } from "~/worker/services/get-product-translations";
import { resolveProductSyncLanguage } from "~/worker/services/resolve-product-sync-language";
import { updateMarketFromWebhook } from "./update-market-from-webhook.server";

/**
 * Updates product variants in Yespo from a Shopify PRODUCTS_UPDATE webhook payload.
 *
 * Fetches product collections via the GraphQL API (not included in the webhook payload)
 * to populate the `categories` field. Determines per-variant action:
 * - "update" if the variant was previously synced (record exists in DB)
 * - "create" if the variant is new (no DB record found)
 *
 * @param payload - Shopify product webhook payload
 * @param apiKey - Yespo API key for authentication
 * @param shopId - Internal shop ID for DB relations
 * @param domain - Shop domain used for logging and URL construction
 * @param orgId - Yespo organisation ID for logging
 * @param siteId - Yespo site/account identifier
 * @param languageCode - BCP 47 language tag stored in DB (shop.defaultLanguageCode)
 * @param shopifyDomain - Shopify myshopify domain for the GraphQL client (session.shop)
 * @param accessToken - Shopify access token for the GraphQL client (session.accessToken)
 * @param shopCurrency - ISO 4217 currency code stored in DB (shop.defaultCurrency)
 * @param syncedLocales - Secondary locales stored in DB (shop.syncedLocales) used to detect removed locales
 * @param isMarketSyncEnabled - Whether market sync is enabled for this shop
 */
export const updateProductVariantService = async (
  payload: any,
  apiKey: string,
  shopId: number,
  domain: string,
  orgId?: number | null,
  siteId?: string | null,
  languageCode?: string | null,
  shopifyDomain?: string,
  accessToken?: string,
  shopCurrency?: string | null,
  syncedLocales: string[] = [],
  isMarketSyncEnabled = false,
) => {
  try {
    const variants: ProductVariantWebhookPayload[] = payload?.variants ?? [];

    if (variants.length === 0) {
      return;
    }

    const productGid: string | undefined = payload?.admin_graphql_api_id;

    const client =
      shopifyDomain && accessToken
        ? createClient({ shop: shopifyDomain, accessToken })
        : null;

    const {
      languageCode: resolvedLanguageCode,
      languageChanged,
      needsLanguageCodePersist,
    } = await resolveProductSyncLanguage({
      client,
      storedLanguageCode: languageCode,
    });

    const [categories, freshLocales, existingSyncs, trackedVariantGids] =
      await Promise.all([
        client && productGid
          ? getProductCollectionsAndCategories({ client, productGid })
          : Promise.resolve([]),
        client && resolvedLanguageCode
          ? getShopSecondaryLocales({
              client,
              primaryLocale: resolvedLanguageCode,
            })
          : Promise.resolve([] as string[]),
        productVariantSyncRepository.getProductVariantSyncByVariantIds(
          variants.map((v) => v.admin_graphql_api_id),
        ),
        productGid
          ? productVariantSyncRepository.getVariantIdsByProductId(
              shopId,
              productGid,
            )
          : Promise.resolve([] as string[]),
      ]);

    // Locales present in DB but absent in Shopify now → must be removed from Yespo
    const removedLocales = syncedLocales.filter(
      (l) => !freshLocales.includes(l),
    );

    const translationsResult =
      client && freshLocales.length > 0 && productGid
        ? await getProductTranslations({
            client,
            productId: productGid,
            variantGids: variants.map((v) => v.admin_graphql_api_id),
            locales: freshLocales,
            shopDomain: domain,
            productHandle: payload?.handle ?? "",
            collections: categories
              .filter(
                (c): c is typeof c & { id: string } =>
                  c.type === "collection" && Boolean(c.id),
              )
              .map((c) => ({ id: c.id, name: c.name })),
          })
        : null;

    const syncMap = new Map(existingSyncs.map((s) => [s.variantId, s]));

    const productVariants = variants.map((variant) => {
      const existing = syncMap.get(variant.admin_graphql_api_id);
      const action = existing ? "update" : "create";
      const previousTagKeys = existing?.syncedTagKeys ?? [];
      return createProductVariantPayloadFromWebhook(
        payload,
        variant,
        shopCurrency ?? "",
        domain,
        action,
        categories,
        previousTagKeys,
        removedLocales,
        translationsResult,
      );
    });

    // Final payload sent to Yespo: category ids are stripped (Yespo doesn't need
    // them). Build it once here so the debug dump and the actual request match.
    const sanitizedProductVariants = productVariants.map(
      stripCategoryIdsFromProduct,
    );

    if (!siteId) {
      console.error(
        `[product-update] Missing siteId for ${domain}; skipping Yespo product sync`,
      );
      return;
    }

    const response = await updateProductVariants({
      apiKey,
      siteId,
      languageCode: resolvedLanguageCode,
      languageChanged,
      productVariants: sanitizedProductVariants,
      domain,
      orgId,
    });

    if (
      shopifyDomain &&
      (needsLanguageCodePersist || response.languageChangedConfirmed)
    ) {
      await shopRepository.updateShop(shopifyDomain, {
        defaultLanguageCode: resolvedLanguageCode,
      });
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const currentTagKeys = Object.keys(productVariants[i].tags ?? {});
      await productVariantSyncRepository.createOrUpdateProductVariantSync({
        variantId: variant.admin_graphql_api_id,
        productId: payload.admin_graphql_api_id,
        syncedTagKeys: currentTagKeys,
        createdAt: variant.created_at ?? payload.created_at,
        updatedAt: variant.updated_at ?? payload.updated_at,
        shop: {
          connect: {
            id: shopId,
          },
        },
      });
    }

    // Detect variants removed from the product in Shopify (e.g. an option value
    // like Size "34" was deleted). A PRODUCTS_UPDATE webhook truncates the
    // `variants` array to 100 items, so it can NOT be trusted for orphan
    // detection — products with >100 variants would have the rest falsely
    // deleted. Instead, fetch the full current variant set via GraphQL
    // (paginated) and only treat tracked variants missing from THAT set as
    // orphaned. If the lookup fails, skip cleanup rather than risk mass-deletion.
    if (productGid && client) {
      const currentVariantGids = await fetchAllProductVariantGids({
        client,
        productId: productGid,
      });

      const presentVariantGids = new Set(currentVariantGids ?? []);
      const orphanedVariantGids =
        presentVariantGids.size > 0
          ? trackedVariantGids.filter((gid) => !presentVariantGids.has(gid))
          : [];

      if (orphanedVariantGids.length > 0) {
        // Yespo stores products by numeric ID extracted from the GID.
        const numericOrphanedIds = orphanedVariantGids.map(
          (gid) => gid.split("/").pop() ?? gid,
        );

        await deleteProductVariants({
          apiKey,
          siteId,
          externalVariantIds: numericOrphanedIds,
          domain,
          orgId,
        });

        await productVariantSyncRepository.deleteByVariantIds(
          shopId,
          orphanedVariantGids,
        );
      }
    }

    if (productGid && shopifyDomain && accessToken) {
      await updateMarketFromWebhook({
        shopId,
        shopifyDomain,
        accessToken,
        productGid,
        isMarketSyncEnabled,
        apiKey,
        siteId: siteId ?? "",
        domain,
        orgId,
      });
    }
  } catch (error: any) {
    console.error("Error occurred in Update Product Variant Service", error);
  }
};
