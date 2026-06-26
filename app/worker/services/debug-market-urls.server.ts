import fs from "node:fs";
import path from "node:path";

const DEBUG_DIR = path.resolve(process.cwd(), "debug");

// Stable per-process id so all entries of one sync run land in the same file
// instead of creating a new file per call.
const RUN_ID = Date.now();

function ensureDir(): void {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

interface MarketRootUrlsDebugEntry {
  marketId: string;
  name: string;
  /** Raw `webPresence.rootUrls` as returned by Shopify (input to collectRootUrls). */
  rawRootUrls: Array<{ locale?: string; url?: string }>;
  /** Output of collectRootUrls: locale → root URL. */
  collectedRootUrls: Record<string, string>;
}

/**
 * Dumps the raw Shopify `webPresence.rootUrls` and the collectRootUrls output for
 * every market into `debug/market-rooturls-<runId>.json`.
 */
export function dumpMarketsRootUrlsDebug(
  entries: MarketRootUrlsDebugEntry[],
): void {
  try {
    ensureDir();
    fs.writeFileSync(
      path.join(DEBUG_DIR, `market-rooturls-${RUN_ID}.json`),
      JSON.stringify(entries, null, 2),
    );
  } catch {
    // debug writes must never break the main flow
  }
}

interface ResolvedUrlDebugEntry {
  marketId?: string;
  marketHandle?: string;
  productHandle: string;
  /** Input to resolveMarketUrls (== collectRootUrls output for this market). */
  inputRootUrls?: Record<string, string>;
  /** Output of resolveMarketUrls: locale → product URL (or null). */
  result: Record<string, string | null> | null;
}

const resolvedEntries: ResolvedUrlDebugEntry[] = [];

/**
 * Appends one resolveMarketUrls input/output pair and rewrites
 * `debug/resolved-market-urls-<runId>.json` with everything collected so far.
 */
export function appendResolvedUrlDebug(entry: ResolvedUrlDebugEntry): void {
  try {
    ensureDir();
    resolvedEntries.push(entry);
    fs.writeFileSync(
      path.join(DEBUG_DIR, `resolved-market-urls-${RUN_ID}.json`),
      JSON.stringify(resolvedEntries, null, 2),
    );
  } catch {
    // debug writes must never break the main flow
  }
}
