import { deleteProductVariants } from "~/api/delete-product-variants";
import { productVariantSyncRepository } from "~/repositories/repositories.server";

/**
 * Handles a PRODUCTS_DELETE webhook from Shopify.
 *
 * The webhook payload contains only the product-level data (no variants list),
 * so we look up all tracked variant GIDs from ProductVariantSync, convert them
 * to numeric IDs expected by the Yespo DELETE /v1/products endpoint, and then
 * clean up our local sync records.
 *
 * **Shopify Product Webhook (REST):**
 * https://shopify.dev/docs/api/admin-rest/latest/resources/product#resource-object
 *
 * @param payload   - Shopify REST webhook payload.
 * @param apiKey    - Basic-auth API key for Yespo.
 * @param shopId    - Internal shop ID used for DB lookups.
 * @param domain    - Shop domain used for logging.
 * @param orgId     - Yespo organisation id used for logging.
 * @param siteId    - Yespo site/account identifier.
 */
export const deleteProductVariantService = async (
  payload: any,
  apiKey: string,
  shopId: number,
  domain: string,
  orgId?: number | null,
  siteId?: string | null,
) => {
  try {
    const productGid: string | undefined = payload?.admin_graphql_api_id;

    if (!productGid) {
      console.warn("PRODUCTS_DELETE webhook missing admin_graphql_api_id — skipping");
      return;
    }

    // Fetch all variant GIDs for this product that we have tracked in our DB.
    const variantGids = await productVariantSyncRepository.getVariantIdsByProductId(
      shopId,
      productGid,
    );

    if (variantGids.length === 0) {
      return;
    }

    // Yespo stores products using the numeric Shopify ID extracted from the GID.
    const numericVariantIds = variantGids.map(
      (gid) => gid.split("/").pop() ?? gid,
    );

    await deleteProductVariants({
      apiKey,
      siteId: siteId ?? "",
      externalVariantIds: numericVariantIds,
      domain,
      orgId,
    });

    // Remove sync records from our DB.
    await productVariantSyncRepository.deleteByProductId(shopId, productGid);
  } catch (error: any) {
    console.error("Error occurred in Delete Product Variant Service", error);
  }
};
