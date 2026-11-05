import { getOfflineAccessToken } from "~/services/get-offline-session.server";
import { createClient } from "~/worker/services/create-client";
import type { MarketVariantPrice } from "~/services/build-status-cart-products";

/**
 * Shopify Admin API rejects input arrays larger than 250, including `nodes(ids:)`.
 * @see https://shopify.dev/docs/api/usage/limits#input-limits
 */
const VARIANT_IDS_BATCH_SIZE = 250;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const MARKET_VARIANT_PRICES_QUERY = `query marketVariantPrices($ids: [ID!]!, $country: CountryCode!) {
  nodes(ids: $ids) {
    ... on ProductVariant {
      id
      contextualPricing(context: { country: $country }) {
        price { amount currencyCode }
      }
    }
  }
}`;

interface VariantPriceNode {
  id?: string;
  contextualPricing?: {
    price?: { amount?: string | null; currencyCode?: string | null } | null;
  } | null;
}

/**
 * Loads the buyer-facing variant price in a market's currency.
 * Keyed by the numeric Shopify variant id. Returns an empty map when the
 * market id is not a country code or Shopify cannot be read, so the caller
 * keeps the webhook values.
 */
export async function getMarketVariantPrices({
  shopUrl,
  variantIds,
  marketId,
}: {
  shopUrl: string;
  variantIds: string[];
  marketId?: string | null;
}): Promise<Map<string, MarketVariantPrice>> {
  const prices = new Map<string, MarketVariantPrice>();
  const country = marketId?.toUpperCase();
  const uniqueIds = [...new Set(variantIds.filter(Boolean))];
  if (!shopUrl || !country || !COUNTRY_CODE_PATTERN.test(country)) return prices;
  if (uniqueIds.length === 0) return prices;

  try {
    const accessToken = await getOfflineAccessToken(shopUrl);
    if (!accessToken) return prices;

    const client = createClient({ shop: shopUrl, accessToken });

    for (
      let offset = 0;
      offset < uniqueIds.length;
      offset += VARIANT_IDS_BATCH_SIZE
    ) {
      const batch = uniqueIds.slice(offset, offset + VARIANT_IDS_BATCH_SIZE);
      const response = await client.request(MARKET_VARIANT_PRICES_QUERY, {
        variables: {
          ids: batch.map((id) => `gid://shopify/ProductVariant/${id}`),
          country,
        },
      });

      if (response?.errors) {
        console.error(
          `Market variant prices query failed for ${shopUrl}:`,
          response.errors.message,
        );
        continue;
      }

      const nodes = (response?.data as { nodes?: Array<VariantPriceNode | null> })
        ?.nodes;

      for (const node of nodes ?? []) {
        const variantId = node?.id?.split("/").pop();
        const price = node?.contextualPricing?.price;
        if (!variantId || !price?.amount || !price.currencyCode) continue;
        prices.set(variantId, {
          amount: price.amount,
          currencyCode: price.currencyCode,
        });
      }
    }
  } catch (error) {
    console.error(`Failed to read market variant prices for ${shopUrl}:`, error);
  }

  return prices;
}
