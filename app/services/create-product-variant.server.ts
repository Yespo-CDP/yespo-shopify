import { updateProductVariants } from "~/api/update-product-variants";
import {
  productVariantSyncRepository,
  shopRepository,
} from "~/repositories/repositories.server";
import {
  createProductVariantPayloadFromWebhook,
  type ProductVariantWebhookPayload,
} from "./create-product-variant-payload-from-webhook";
import { createClient } from "~/worker/services/create-client";
import { getProductCollections } from "~/worker/services/get-product-collections";
import { getShopSecondaryLocales } from "~/worker/services/get-shop-locales";
import { getProductTranslations } from "~/worker/services/get-product-translations";
import { resolveProductSyncLanguage } from "~/worker/services/resolve-product-sync-language";
import { updateMarketFromWebhook } from "./update-market-from-webhook.server";

/**
 * Creates product variants in Yespo from a Shopify PRODUCTS_CREATE webhook payload.
 *
 * Fetches product collections via the GraphQL API (not included in the webhook payload)
 * to populate the required `categories` field. Determines `action: "create"` for all
 * variants since this is a new product event.
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
export const createProductVariantService = async (
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

    const [categories, freshLocales] = await Promise.all([
      client && payload?.admin_graphql_api_id
        ? getProductCollections({ client, productGid: payload.admin_graphql_api_id })
        : Promise.resolve([]),
      client && resolvedLanguageCode
        ? getShopSecondaryLocales({ client, primaryLocale: resolvedLanguageCode })
        : Promise.resolve([] as string[]),
    ]);

    const translationsResult =
      client && freshLocales.length > 0 && payload?.admin_graphql_api_id
        ? await getProductTranslations({
            client,
            productId: payload.admin_graphql_api_id,
            variantGids: variants.map((v) => v.admin_graphql_api_id),
            locales: freshLocales,
            shopDomain: domain,
            productHandle: payload.handle ?? "",
            collections: categories.map((c) => ({ id: c.id, name: c.name })),
          })
        : null;

    const productVariants = variants.map((variant) =>
      createProductVariantPayloadFromWebhook(
        payload,
        variant,
        shopCurrency ?? "",
        domain,
        "create",
        categories,
        [],
        [],
        translationsResult,
      ),
    );

    const response = await updateProductVariants({
      apiKey,
      siteId: siteId ?? "",
      languageCode: resolvedLanguageCode,
      languageChanged,
      productVariants,
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
    if (shopifyDomain && accessToken && payload?.admin_graphql_api_id) {
      await updateMarketFromWebhook({
        shopId,
        shopifyDomain,
        accessToken,
        productGid: payload.admin_graphql_api_id,
        isMarketSyncEnabled,
        apiKey,
        siteId: siteId ?? "",
        domain,
        orgId,
      });
    }
  } catch (error: any) {
    console.error("Error occurred in Create Product Variant Service", error);
  }
};
