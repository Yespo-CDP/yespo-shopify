import { createWebPushDomain } from "~/api/create-webpush-domain.server";
import { getWebpushScript } from "~/api/get-webpush-script.server";
import createMetafield from "~/shopify/mutations/create-metafield.server";
import createMetafieldDefinition from "~/shopify/mutations/create-metafield-definition.server";
import getMetafield from "~/shopify/queries/get-metafield";
import getMetafieldDefinition from "~/shopify/queries/get-metafield-definition";

import {
  collectStorefrontHosts,
  diffStorefrontHosts,
} from "./collect-storefront-hosts";

const WEB_PUSH_MULTI_DOMAIN_HANDLE =
  process.env.WEB_PUSH_MULTI_DOMAIN_HANDLE ?? "yespo-web-push-multi-domain";

const MARKETS_PAGE_SIZE = 250;

interface MarketRootUrlsPage {
  markets?: {
    nodes?: Array<{
      enabled?: boolean;
      webPresence?: {
        rootUrls?: Array<{ url?: string | null }>;
      } | null;
    }>;
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
  };
}

async function fetchMarketRootUrlsPage(
  admin: any,
  cursor: string | null,
): Promise<NonNullable<MarketRootUrlsPage["markets"]>> {
  const response = await admin.graphql(
    `#graphql
      query getMarketRootUrls($count: Int!, $cursor: String) {
        markets(first: $count, after: $cursor) {
          nodes {
            enabled
            webPresence {
              rootUrls {
                url
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    { variables: { count: MARKETS_PAGE_SIZE, cursor } },
  );

  const parsed = (await response.json()) as {
    errors?: unknown[];
    data?: MarketRootUrlsPage;
  };
  if (parsed.errors?.length) {
    throw new Error(
      `Failed to read market root URLs: ${JSON.stringify(parsed.errors)}`,
    );
  }

  const markets = parsed.data?.markets;
  if (!markets) {
    throw new Error("Failed to read market root URLs: empty response");
  }

  return markets;
}

async function fetchEnabledMarketRootUrls(admin: any): Promise<string[]> {
  const urls: string[] = [];
  let cursor: string | null = null;

  do {
    const markets = await fetchMarketRootUrlsPage(admin, cursor);

    for (const market of markets.nodes ?? []) {
      if (!market.enabled) {
        continue;
      }
      for (const entry of market.webPresence?.rootUrls ?? []) {
        if (entry.url) {
          urls.push(entry.url);
        }
      }
    }

    cursor = markets.pageInfo?.hasNextPage
      ? (markets.pageInfo.endCursor ?? null)
      : null;
  } while (cursor);

  return urls;
}

function isAlreadyRegistered(error: unknown): boolean {
  return (
    error instanceof Error && error.message === "domainAlreadyRegisteredError"
  );
}

function parseStoredScripts(value: unknown): Record<string, string> {
  if (typeof value !== "string" || !value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const scripts: Record<string, string> = {};
    for (const [host, script] of Object.entries(parsed)) {
      if (typeof script === "string" && script) {
        scripts[host] = script;
      }
    }
    return scripts;
  } catch {
    return {};
  }
}

/**
 * Registers each storefront host for web push, fetches its script, and merges
 * `{ hostname: script }` into the JSON multi-domain metafield.
 * The legacy single-domain web push metafield is left unchanged.
 */
export async function syncMarketWebPushScripts({
  admin,
  apiKey,
  shopId,
  domain,
  orgId,
}: {
  admin: any;
  apiKey: string;
  shopId: string;
  domain: string;
  orgId?: number | null;
}): Promise<{ hosts: string[]; failedHosts: string[] }> {
  const rootUrls = await fetchEnabledMarketRootUrls(admin);
  const hosts = collectStorefrontHosts(domain, rootUrls);
  const definition = await getMetafieldDefinition({
    admin,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
  });
  if (!definition) {
    await createMetafieldDefinition({
      admin,
      key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
      name: "Yespo web push multi domain",
      type: "json",
      description: "Web push scripts keyed by storefront domain",
    });
  }

  const existing = await getMetafield({
    admin,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
  });
  const scripts = parseStoredScripts(existing?.value);
  const updatedHosts: string[] = [];
  const failedHosts: string[] = [];

  for (const host of hosts) {
    try {
      try {
        await createWebPushDomain({ apiKey, domain: host, orgId });
      } catch (error) {
        if (!isAlreadyRegistered(error)) {
          throw error;
        }
      }

      scripts[host] = await getWebpushScript({ apiKey, domain: host, orgId });
      updatedHosts.push(host);
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      const yespoBody =
        cause && typeof cause === "object" && "responseData" in cause
          ? (cause as { responseData?: unknown }).responseData
          : cause;
      console.error(
        `[sync-market-web-push-scripts] ${host}:`,
        error instanceof Error ? error.message : error,
        cause instanceof Error ? cause.message : "",
        yespoBody ?? "",
      );
      failedHosts.push(host);
    }
  }

  if (updatedHosts.length === 0) {
    throw new Error("marketWebPushScriptsError");
  }

  const metafield = await createMetafield({
    admin,
    shopId,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
    type: "json",
    value: JSON.stringify(scripts),
    collapseWhitespace: false,
  });

  if (!metafield) {
    throw new Error("marketWebPushScriptsError");
  }

  return { hosts: updatedHosts, failedHosts };
}

async function loadWebPushScript({
  apiKey,
  host,
  orgId,
}: {
  apiKey: string;
  host: string;
  orgId?: number | null;
}): Promise<string> {
  try {
    await createWebPushDomain({ apiKey, domain: host, orgId });
  } catch (error) {
    if (!isAlreadyRegistered(error)) {
      throw error;
    }
  }

  return getWebpushScript({ apiKey, domain: host, orgId });
}

/**
 * Compares current market root-URL hosts with the multi-domain metafield.
 * Registers scripts for new hosts and leaves hosts already stored, including
 * ones whose market is no longer enabled. Writes the metafield only when a
 * new host was added. Shops that have never stored market scripts and have
 * web push off are left untouched.
 */
export async function reconcileMarketWebPushScripts({
  admin,
  apiKey,
  shopId,
  domain,
  orgId,
  webPushInstalled,
}: {
  admin: any;
  apiKey: string;
  shopId: string;
  domain: string;
  orgId?: number | null;
  webPushInstalled: boolean;
}): Promise<{ changed: boolean; added: string[]; removed: string[] }> {
  const existing = await getMetafield({
    admin,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
  });
  const scripts = parseStoredScripts(existing?.value);
  const storedHosts = Object.keys(scripts);

  if (!webPushInstalled && storedHosts.length === 0) {
    return { changed: false, added: [], removed: [] };
  }

  const rootUrls = await fetchEnabledMarketRootUrls(admin);
  const desiredHosts = collectStorefrontHosts(domain, rootUrls);
  const { added } = diffStorefrontHosts(desiredHosts, storedHosts);

  if (added.length === 0) {
    return { changed: false, added, removed: [] };
  }

  for (const host of added) {
    scripts[host] = await loadWebPushScript({ apiKey, host, orgId });
  }

  const definition = await getMetafieldDefinition({
    admin,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
  });
  if (!definition) {
    await createMetafieldDefinition({
      admin,
      key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
      name: "Yespo web push multi domain",
      type: "json",
      description: "Web push scripts keyed by storefront domain",
    });
  }

  const metafield = await createMetafield({
    admin,
    shopId,
    key: WEB_PUSH_MULTI_DOMAIN_HANDLE,
    type: "json",
    value: JSON.stringify(scripts),
    collapseWhitespace: false,
  });

  if (!metafield) {
    throw new Error("marketWebPushScriptsError");
  }

  return { changed: true, added, removed: [] };
}
