import type { GraphQLClient } from "@shopify/graphql-client";

import createMetafield from "~/shopify/mutations/create-metafield.server";
import createMetafieldDefinition from "~/shopify/mutations/create-metafield-definition.server";
import getMetafieldDefinition from "~/shopify/queries/get-metafield-definition";

import { MARKET_TRACKING_ENABLED_KEY } from "./market-tracking";

const DEFINITION_NAME = "Market tracking enabled";
const DEFINITION_DESCRIPTION =
  "Send marketId in web tracking events when the shop syncs more than one market";

const MARKETS_PAGE_SIZE = 250;

interface MarketsCountPage {
  markets?: {
    nodes?: Array<{ enabled?: boolean }>;
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
  };
}

/**
 * Writes the storefront boolean that decides whether page events include marketId.
 * The country code itself is read from the page, not stored here.
 */
export async function setMarketTrackingMetafield({
  admin,
  shopId,
  enabled,
}: {
  admin: any;
  shopId: string;
  enabled: boolean;
}): Promise<boolean> {
  const definition = await getMetafieldDefinition({
    admin,
    key: MARKET_TRACKING_ENABLED_KEY,
  });
  if (!definition) {
    await createMetafieldDefinition({
      admin,
      key: MARKET_TRACKING_ENABLED_KEY,
      name: DEFINITION_NAME,
      type: "boolean",
      description: DEFINITION_DESCRIPTION,
    });
  }

  const metafield = await createMetafield({
    shopId,
    admin,
    value: enabled ? "true" : "false",
    type: "boolean",
    key: MARKET_TRACKING_ENABLED_KEY,
  });

  if (!metafield) {
    console.error(
      `Failed to set ${MARKET_TRACKING_ENABLED_KEY} to ${enabled} for ${shopId}`,
    );
    return false;
  }

  return true;
}

/**
 * Same write as setMarketTrackingMetafield, for the market-sync worker, which
 * talks to Shopify with an offline token instead of the admin client.
 */
export async function setMarketTrackingMetafieldWithClient({
  client,
  shopId,
  enabled,
}: {
  client: GraphQLClient;
  shopId: string;
  enabled: boolean;
}): Promise<boolean> {
  try {
    await ensureMarketTrackingDefinition(client);
    const response = await client.request(
      `mutation setMarketTracking($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              key: MARKET_TRACKING_ENABLED_KEY,
              namespace: "$app",
              type: "boolean",
              value: enabled ? "true" : "false",
              ownerId: shopId,
            },
          ],
        },
      },
    );

    const userErrors = response?.data?.metafieldsSet?.userErrors ?? [];
    if (userErrors.length > 0) {
      console.error(
        `Failed to set ${MARKET_TRACKING_ENABLED_KEY}`,
        userErrors,
      );
      return false;
    }

    return Boolean(response?.data?.metafieldsSet?.metafields?.[0]);
  } catch (error) {
    console.error(
      `Failed to set ${MARKET_TRACKING_ENABLED_KEY} for ${shopId}`,
      error,
    );
    return false;
  }
}

export async function countEnabledMarkets(admin: any): Promise<number> {
  let count = 0;
  let cursor: string | null = null;

  do {
    const response = await admin.graphql(
      `#graphql
        query countEnabledMarkets($count: Int!, $cursor: String) {
          markets(first: $count, after: $cursor) {
            nodes { enabled }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      { variables: { count: MARKETS_PAGE_SIZE, cursor } },
    );
    const parsed = (await response.json()) as {
      errors?: unknown[];
      data?: MarketsCountPage;
    };
    if (parsed.errors?.length) {
      throw new Error(
        `Failed to count markets: ${JSON.stringify(parsed.errors)}`,
      );
    }

    const markets = parsed.data?.markets;
    if (!markets) {
      throw new Error("Failed to count markets: empty response");
    }

    for (const market of markets.nodes ?? []) {
      if (market.enabled) count += 1;
    }

    cursor = markets.pageInfo?.hasNextPage
      ? (markets.pageInfo.endCursor ?? null)
      : null;
  } while (cursor);

  return count;
}

async function ensureMarketTrackingDefinition(
  client: GraphQLClient,
): Promise<void> {
  const existing = await client.request(
    `query marketTrackingDefinition($key: String!, $namespace: String) {
      metafieldDefinitions(
        first: 1
        ownerType: SHOP
        key: $key
        namespace: $namespace
      ) {
        nodes { id }
      }
    }`,
    {
      variables: {
        key: MARKET_TRACKING_ENABLED_KEY,
        namespace: "$app",
      },
    },
  );

  if (existing?.data?.metafieldDefinitions?.nodes?.length) return;

  await client.request(
    `mutation createMarketTrackingDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        definition: {
          access: {
            admin: "MERCHANT_READ",
            storefront: "PUBLIC_READ",
          },
          key: MARKET_TRACKING_ENABLED_KEY,
          name: DEFINITION_NAME,
          description: DEFINITION_DESCRIPTION,
          namespace: "$app",
          type: "boolean",
          ownerType: "SHOP",
        },
      },
    },
  );
}
