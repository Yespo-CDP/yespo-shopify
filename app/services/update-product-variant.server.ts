import { updateProductVariants } from "~/api/update-product-variants";
import { productVariantSyncRepository } from "~/repositories/repositories.server";
import {
  createProductVariantPayloadFromWebhook,
  type ProductVariantWebhookPayload,
} from "./create-product-variant-payload-from-webhook";

/**
 * Updates product variants using the provided payload and API key.
 *
 * Any errors during the process are caught and logged.
 *
 * **Shopify Product Webhook (REST):**
 * https://shopify.dev/docs/api/admin-rest/latest/resources/product#resource-object
 *
 * **Field Mapping:**
 * - `payload.id` → `externalProductId`
 * - `payload.title` + `variant.title` → `name`
 * - `payload.body_html` → `description`
 * - `variant.id` → `externalVariantId`
 * - `variant.price` → `price`
 * - `variant.admin_graphql_api_id` → `variantId` (for db sync log)
 * - `payload.admin_graphql_api_id` → `productId` (for db sync log)
 * - `variant.created_at` / `payload.created_at` → `createdAt` (for db sync log)
 * - `variant.updated_at` / `payload.updated_at` → `updatedAt` (for db sync log)
 *
 * @param {any} payload - The product data payload containing variant info.
 * @param {string} apiKey - The API key used for authentication with the Yespo API.
 * @param {number} shopId - The shop id for connect product variant sync log to shop.
 * @param domain
 * @param orgId
 * @returns {Promise<void>} A promise that resolves when the product variant update completes.
 */
export const updateProductVariantService = async (
  payload: any,
  apiKey: string,
  shopId: number,
  domain: string,
  orgId?: number | null,
) => {
  try {
    const variants = payload?.variants ?? [];

    if (variants.length === 0) {
      return;
    }

    const productVariants = variants.map(
      (variant: ProductVariantWebhookPayload) =>
        createProductVariantPayloadFromWebhook(payload, variant),
    );

    await updateProductVariants({
      apiKey,
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
