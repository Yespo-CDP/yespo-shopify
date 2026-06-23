import fs from "node:fs";
import path from "node:path";
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
import { getShopPrimaryLocale } from "../services/get-shop-primary-locale";
import { getShopSecondaryLocales } from "../services/get-shop-locales";
import {
  getProductTranslations,
  type ProductTranslationsResult,
} from "../services/get-product-translations";
import { sendLogEvent } from "~/api/send-log-event";
import { EVENT_MESSAGES } from "~/config/constants";

const PRODUCTS_CHUNK_SIZE = 50;
const VARIANTS_API_CHUNK_SIZE = 500;

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
  siteId?: string | null,
) => {
  console.log(`⏳ Synchronizing products start for ${shop}`);

  const client = createClient({ shop, accessToken });
  const variantsCount = await getProductVariantsCount({ client });

  console.log("Total product variants count", variantsCount, "\n");

  // Determine languageCode and whether a language change needs to be signalled to Yespo.
  // Fetch the current Shopify primary locale and all secondary locales once at the start.
  const [currentLocale, shopData] = await Promise.all([
    getShopPrimaryLocale({ client }),
    shopRepository.getShop(shop),
  ]);
  const storedLanguageCode = shopData?.defaultLanguageCode ?? null;
  const languageCode = currentLocale ?? storedLanguageCode ?? "en";

  const secondaryLocales = await getShopSecondaryLocales({
    client,
    primaryLocale: languageCode,
  });
  const hasTranslations = secondaryLocales.length > 0;

  // pendingLanguageChanged: sent as true on the FIRST API batch only, then flipped to false.
  // Covers two cases:
  //   - language intentionally changed: storedLanguageCode !== null && !== languageCode
  //   - first ever sync: storedLanguageCode === null (Yespo has no record yet, languageChanged: false is fine)
  let pendingLanguageChanged =
    storedLanguageCode !== null && storedLanguageCode !== languageCode;

  // needsLanguageCodePersist: true whenever the stored value differs from the current one
  // (first sync or language change). Flipped to false after the first batch so DB is updated only once.
  let needsLanguageCodePersist = languageCode !== storedLanguageCode;

  let cursor: string | null | undefined = null;
  let shopCurrency = "";
  let totalSkippedCount = 0;
  let totalFailedCount = 0;
  let totalSyncedCount = 0;

  try {
    do {
      try {
        console.log("\n", "Chunk start:");

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

            const productTranslations = hasTranslations
              ? await getProductTranslations({
                  client,
                  productId: product.id,
                  variantGids: variants.map((v) => v.id),
                  locales: secondaryLocales,
                  shopDomain: shop,
                  productHandle: product.handle,
                  collections: product.collections?.nodes ?? [],
                })
              : ({ product: {}, variants: {} } satisfies ProductTranslationsResult);

            if (Object.keys(productTranslations.product).length > 0) {
              product.translations = productTranslations.product;
            }
            if (Object.keys(productTranslations.variants).length > 0) {
              product.variantTranslations = productTranslations.variants;
            }

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
                const action = productVariantSync ? "update" : "create";
                // Use the public custom domain for URL construction (fallback when
                // onlineStoreUrl is null). shopData.domain is the primary domain
                // (custom domain if set, otherwise the myshopify.com domain).
                const shopDomain = shopData?.domain ?? shop;
                productVariantsData.push(
                  createProductVariantPayload(
                    product,
                    variant,
                    shopCurrency,
                    shopDomain,
                    action,
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
            const debugDir = path.resolve(process.cwd(), "debug");
            fs.mkdirSync(debugDir, { recursive: true });
            fs.writeFileSync(
              path.join(debugDir, `product-sync-chunk-${Date.now()}.json`),
              JSON.stringify(variantsChunk, null, 2),
            );

            const variantsUpdateResponse = await updateProductVariants({
              apiKey,
              siteId: siteId ?? "",
              languageCode,
              languageChanged: pendingLanguageChanged,
              productVariants: variantsChunk,
              domain: shop,
              orgId,
            });

            // After the first successful batch: clear both flags.
            // pendingLanguageChanged → false so subsequent batches use languageChanged: false.
            // needsLanguageCodePersist → false so DB is updated only once per sync run.
            if (pendingLanguageChanged) {
              pendingLanguageChanged = false;
            }
            if (needsLanguageCodePersist) {
              needsLanguageCodePersist = false;
              await shopRepository.updateShop(shop, {
                defaultLanguageCode: languageCode,
                ...(shopCurrency ? { defaultCurrency: shopCurrency } : {}),
              });
            }

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
