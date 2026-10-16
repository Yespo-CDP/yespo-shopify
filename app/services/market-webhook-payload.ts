const MARKET_GID_PREFIX = "gid://shopify/Market/";

/**
 * Market id from a markets/create payload.
 *
 * Shopify sends a numeric REST id (`{ "id": 188558248, "status": "active" }`).
 * Catalog sync stores the GraphQL gid, so the numeric id is expanded to
 * `gid://shopify/Market/{id}`.
 */
export function marketGidFromWebhook(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const graphqlId = record.admin_graphql_api_id;
  if (typeof graphqlId === "string" && graphqlId.startsWith(MARKET_GID_PREFIX)) {
    return graphqlId;
  }

  const id = record.id;
  if (typeof id === "string" && id.startsWith(MARKET_GID_PREFIX)) {
    return id;
  }
  if (typeof id === "number" && Number.isInteger(id) && id > 0) {
    return `${MARKET_GID_PREFIX}${id}`;
  }
  if (typeof id === "string" && /^\d+$/.test(id)) {
    return `${MARKET_GID_PREFIX}${id}`;
  }
  return null;
}

/**
 * `markets/create` uses `status: "active"` for a market that should be synced.
 * A missing status is treated as active so the new market is not dropped.
 */
export function isActiveMarketStatus(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return true;
  const status = (payload as Record<string, unknown>).status;
  if (typeof status !== "string" || status.trim() === "") return true;
  return status.trim().toLowerCase() === "active";
}
