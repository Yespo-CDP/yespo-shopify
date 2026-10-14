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
