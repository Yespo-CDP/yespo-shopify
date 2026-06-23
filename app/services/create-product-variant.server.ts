import { updateProductVariants } from "~/api/update-product-variants";
import {
  productVariantSyncRepository,
} from "~/repositories/repositories.server";
import {
  createProductVariantPayloadFromWebhook,
  type ProductVariantWebhookPayload,
} from "./create-product-variant-payload-from-webhook";
import { createClient } from "~/worker/services/create-client";
import { getProductCollections } from "~/worker/services/get-product-collections";

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
) => {
  try {
    const variants: ProductVariantWebhookPayload[] = payload?.variants ?? [];

    if (variants.length === 0) {
      return;
    }

    const categories =
      shopifyDomain && accessToken && payload?.admin_graphql_api_id
        ? await getProductCollections({
            client: createClient({ shop: shopifyDomain, accessToken }),
            productGid: payload.admin_graphql_api_id,
          })
        : [];

    const productVariants = variants.map((variant) =>
      createProductVariantPayloadFromWebhook(
        payload,
        variant,
        shopCurrency ?? "",
        domain,
        "create",
        categories,
        // action: "create" → no previous keys, no removed locales
      ),
    );

    await updateProductVariants({
      apiKey,
      siteId: siteId ?? "",
      languageCode: languageCode ?? "",
      productVariants,
      domain,
      orgId,
    });

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
  } catch (error: any) {
    console.error("Error occurred in Create Product Variant Service", error);
  }
};
