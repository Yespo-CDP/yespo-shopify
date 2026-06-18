import { deleteProductVariants } from "~/api/delete-product-variants";

/**
 * Deletes product variants using the provided payload and API key.
 *
 * **Shopify Product Webhook (REST):**
 * https://shopify.dev/docs/api/admin-rest/latest/resources/product#resource-object
 *
 * **Field Mapping:**
 * - `variant.id` → `externalVariantId`
 *
 * @param {any} payload - The product data payload containing variant info.
 * @param {string} apiKey - The API key used for authentication with the Yespo API.
 * @param domain
 * @param orgId
 * @returns {Promise<void>} A promise that resolves when the product variant deletion completes.
 */
export const deleteProductVariantService = async (
  payload: any,
  apiKey: string,
  domain: string,
  orgId?: number | null,
) => {
  try {
    const externalVariantIds = (payload?.variants ?? []).map(
      (variant: { id: number }) => variant.id.toString(),
    );

    if (externalVariantIds.length === 0) {
      return;
    }

    await deleteProductVariants({
      apiKey,
      externalVariantIds,
      domain,
      orgId,
    });
  } catch (error: any) {
    console.error("Error occurred in Delete Product Variant Service", error);
  }
};
