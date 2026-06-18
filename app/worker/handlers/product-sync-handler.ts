import type { ProductVariant } from "~/@types/productVariant";
import {
  shopRepository,
  productVariantSyncRepository,
  productVariantSyncLogRepository,
} from "~/repositories/repositories.server";
import { updateProductVariants } from "~/api/update-product-variants";
import { createClient } from "../services/create-client";
import { getProducts } from "../services/get-products";
import { getProductVariantsCount } from "../services/get-product-variants-count";
import { fetchAllProductVariants } from "../services/get-product-variants";
import { createProductVariantPayload } from "../services/create-product-variant-payload";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

const PRODUCTS_CHUNK_SIZE = 50;
const VARIANTS_API_CHUNK_SIZE = 200;

/**
 * Syncs product variants from Shopify with Yespo.
 *
 * Products are fetched in paginated chunks. For each product, all variants are
 * collected via nested pagination before being sent to Yespo.
 */
export const productSyncHandler = async (
  shop: string,
  accessToken: string,
  apiKey: string,
  shopId: number,
  orgId?: number | null,
) => {
  console.log(`⏳ Synchronizing products start for ${shop}`);

  const client = createClient({ shop, accessToken });
  const variantsCount = await getProductVariantsCount({ client });

  console.log("Total product variants count", variantsCount, "\n");

  let cursor: string | null | undefined = null;
  let shopCurrency = "";
  let totalSkippedCount = 0;
  let totalFailedCount = 0;
  let totalSyncedCount = 0;

  try {
    do {
      try {
        console.log("\n", "Chunk start:");
        const shopData = await shopRepository.getShop(shop);

        if (shopData?.isProductVariantSyncEnabled) {
          const response = await getProducts({
            client,
            count: PRODUCTS_CHUNK_SIZE,
            cursor,
          });
          const products = response.products;
          cursor = response.cursor;
          shopCurrency = response.shopCurrency ?? shopCurrency;

          const productVariantsData: ProductVariant[] = [];
          let chunkSkippedCount = 0;
          let chunkFailedCount = 0;

          for (const product of products) {
            const variants = await fetchAllProductVariants({ client, product });
            const variantIds = variants.map((variant) => variant.id);
            const productVariantSyncs =
              await productVariantSyncRepository.getProductVariantSyncByVariantIds(
                variantIds,
              );

            for (const variant of variants) {
              const productVariantSync = productVariantSyncs.find(
                (value) => value.variantId === variant.id,
              );

              const variantUpdatedDate =
                new Date(variant.updatedAt)?.getTime() ?? 0;
              const productUpdatedDate =
                new Date(product.updatedAt)?.getTime() ?? 0;
              const entityUpdatedDate = Math.max(
                variantUpdatedDate,
                productUpdatedDate,
              );
              const syncUpdatedDate =
                productVariantSync?.updatedAt?.getTime() ?? 0;

              if (entityUpdatedDate > syncUpdatedDate) {
                productVariantsData.push(
                  createProductVariantPayload(
                    product,
                    variant,
                    shopCurrency,
                  ),
                );

                await productVariantSyncRepository.createOrUpdateProductVariantSync(
                  {
                    variantId: variant.id,
                    productId: product.id,
                    createdAt: variant.createdAt ?? product.createdAt,
                    updatedAt: variant.updatedAt ?? product.updatedAt,
                    shop: {
                      connect: {
                        id: shopId,
                      },
                    },
                  },
                );
              } else {
                chunkSkippedCount++;
              }
            }
          }

          for (
            let index = 0;
            index < productVariantsData.length;
            index += VARIANTS_API_CHUNK_SIZE
          ) {
            const variantsChunk = productVariantsData.slice(
              index,
              index + VARIANTS_API_CHUNK_SIZE,
            );

            if (variantsChunk.length === 0) {
              continue;
            }

            const variantsUpdateResponse = await updateProductVariants({
              apiKey,
              productVariants: variantsChunk,
              domain: shop,
              orgId,
            });

            if (variantsUpdateResponse?.failedVariants) {
              if (Array.isArray(variantsUpdateResponse.failedVariants)) {
                chunkFailedCount +=
                  variantsUpdateResponse.failedVariants.length;
              } else {
                chunkFailedCount += 1;
              }
            }

            await sendLogEvent({
              orgId,
              errorMessage: "",
              data: JSON.stringify({
                domain: shop,
                offset: VARIANTS_API_CHUNK_SIZE,
                responseBody: variantsUpdateResponse,
                statusCode: 200,
              }),
              message: EVENT_MESSAGES.SEND_PRODUCT_VARIANTS_BULK_SUCCESS,
              logLevel: "INFO",
            });
          }

          totalFailedCount += chunkFailedCount;
          totalSkippedCount += chunkSkippedCount;
          totalSyncedCount += productVariantsData.length - chunkFailedCount;

          console.log("Total products in chunk:", products?.length);
          console.log("Total skipped variants in chunk:", chunkSkippedCount);
          console.log(
            "Total sent variants to sync:",
            productVariantsData?.length,
          );
          console.log("Total failed variants sync:", chunkFailedCount);

          await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog(
            {
              status: "IN_PROGRESS",
              skippedCount: totalSkippedCount,
              failedCount: totalFailedCount,
              syncedCount: totalSyncedCount,
              totalCount: variantsCount,
              shop: {
                connect: {
                  id: shopId,
                },
              },
            },
          );
        } else {
          console.log(`⚠️ Synchronization products cancelled for ${shop}`);
          cursor = null;
        }
      } catch (error: any) {
        console.error("Error products sync in chunk", error);

        await sendLogEvent({
          orgId,
          errorMessage: `Error bulk products sync ${error?.message}`,
          data: JSON.stringify({
            domain: shop,
            offset: VARIANTS_API_CHUNK_SIZE,
            responseBody: {},
            statusCode: error?.status ?? 400,
          }),
          message: EVENT_MESSAGES.SEND_PRODUCT_VARIANTS_BULK_FAILED,
          logLevel: "ERROR",
        });

        throw Error(error);
      }
    } while (cursor);

    await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog({
      status: "COMPLETE",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: variantsCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });

    console.log(`✅ Synchronizing products finish for ${shop}`);
  } catch (error: any) {
    console.error("Synchronization error", error);
    await productVariantSyncLogRepository.createOrUpdateProductVariantSyncLog({
      status: "ERROR",
      skippedCount: totalSkippedCount,
      failedCount: totalFailedCount,
      syncedCount: totalSyncedCount,
      totalCount: variantsCount,
      shop: {
        connect: {
          id: shopId,
        },
      },
    });

    return;
  }
};
