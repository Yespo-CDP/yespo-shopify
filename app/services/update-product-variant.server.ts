import { updateProductVariants } from "~/api/update-product-variants";
import { productVariantSyncRepository } from "~/repositories/repositories.server";
import {
  createProductVariantPayloadFromWebhook,
  type ProductVariantWebhookPayload,
} from "./create-product-variant-payload-from-webhook";
import { createClient } from "~/worker/services/create-client";
import { getProductCollections } from "~/worker/services/get-product-collections";

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
 * @param shopCurrency - ISO 4217 currency code stored in DB (shop.currency)
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
) => {
  try {
    const variants: ProductVariantWebhookPayload[] = payload?.variants ?? [];

    if (variants.length === 0) {
      return;
    }

    const [categories, existingSyncs] = await Promise.all([
      shopifyDomain && accessToken && payload?.admin_graphql_api_id
        ? getProductCollections({
            client: createClient({ shop: shopifyDomain, accessToken }),
            productGid: payload.admin_graphql_api_id,
          })
        : Promise.resolve([]),
      productVariantSyncRepository.getProductVariantSyncByVariantIds(
        variants.map((v) => v.admin_graphql_api_id),
      ),
    ]);

    const syncedIds = new Set(existingSyncs.map((s) => s.variantId));

    const productVariants = variants.map((variant) => {
      const action = syncedIds.has(variant.admin_graphql_api_id)
        ? "update"
        : "create";
      return createProductVariantPayloadFromWebhook(
        payload,
        variant,
        shopCurrency ?? "",
        domain,
        action,
        categories,
      );
    });

    await updateProductVariants({
      apiKey,
      siteId: siteId ?? "",
      languageCode: languageCode ?? "",
      productVariants,
      domain,
      orgId,
    });

    for (const variant of variants) {
      await productVariantSyncRepository.createOrUpdateProductVariantSync({
        variantId: variant.admin_graphql_api_id,
        productId: payload.admin_graphql_api_id,
        createdAt: variant.created_at ?? payload.created_at,
        updatedAt: variant.updated_at ?? payload.updated_at,
        shop: {
          connect: {
            id: shopId,
          },
        },
      });
    }
  } catch (error: any) {
    console.error("Error occurred in Update Product Variant Service", error);
  }
};
