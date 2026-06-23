import fs from "node:fs";
import path from "node:path";
import { updateProductVariants } from "~/api/update-product-variants";
import { deleteProductVariants } from "~/api/delete-product-variants";
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
 * @param shopCurrency - ISO 4217 currency code stored in DB (shop.defaultCurrency)
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

    const productGid: string | undefined = payload?.admin_graphql_api_id;

    const [categories, existingSyncs, trackedVariantGids] = await Promise.all([
      shopifyDomain && accessToken && productGid
        ? getProductCollections({
            client: createClient({ shop: shopifyDomain, accessToken }),
            productGid,
          })
        : Promise.resolve([]),
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

    const syncMap = new Map(existingSyncs.map((s) => [s.variantId, s]));

    const productVariants = variants.map((variant) => {
      const existing = syncMap.get(variant.admin_graphql_api_id);
      const action = existing ? "update" : "create";
      const previousTagKeys = existing?.syncedTagKeys ?? [];
      // Locale removal is a shop-level event — handled in bulk sync, not per webhook.
      return createProductVariantPayloadFromWebhook(
        payload,
        variant,
        shopCurrency ?? "",
        domain,
        action,
        categories,
        previousTagKeys,
      );
    });

    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(
      path.join(debugDir, `product-update-webhook-${Date.now()}.json`),
      JSON.stringify(
        {
          siteId: siteId ?? "",
          languageCode: languageCode ?? "",
          products: productVariants,
        },
        null,
        2,
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

    // Detect variants removed from the product in Shopify (e.g. an option value
    // like Size "34" was deleted). A PRODUCTS_UPDATE webhook only carries the
    // surviving variants, so any previously tracked variant GID absent from this
    // payload is now orphaned in Yespo and must be deleted explicitly.
    if (productGid) {
      const presentVariantGids = new Set(
        variants.map((v) => v.admin_graphql_api_id),
      );
      const orphanedVariantGids = trackedVariantGids.filter(
        (gid) => !presentVariantGids.has(gid),
      );

      if (orphanedVariantGids.length > 0) {
        // Yespo stores products by numeric ID extracted from the GID.
        const numericOrphanedIds = orphanedVariantGids.map(
          (gid) => gid.split("/").pop() ?? gid,
        );

        fs.writeFileSync(
          path.join(debugDir, `product-delete-webhook-${Date.now()}.json`),
          JSON.stringify(
            {
              siteId: siteId ?? "",
              products: numericOrphanedIds.map((productId) => ({
                productId,
              })),
            },
            null,
            2,
          ),
        );

        // await deleteProductVariants({
        //   apiKey,
        //   siteId: siteId ?? "",
        //   externalVariantIds: numericOrphanedIds,
        //   domain,
        //   orgId,
        // });

        await productVariantSyncRepository.deleteByVariantIds(
          shopId,
          orphanedVariantGids,
        );
      }
    }
  } catch (error: any) {
    console.error("Error occurred in Update Product Variant Service", error);
  }
};
