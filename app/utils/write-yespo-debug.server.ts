import fs from "node:fs";
import path from "node:path";

/**
 * Writes the outbound Yespo payload to `debug/` before the HTTP call.
 * A failed write is logged and swallowed so inspection never blocks sync.
 */
export function writeYespoDebugFile(filePrefix: string, payload: unknown): void {
  try {
    const debugDir = path.resolve(process.cwd(), "debug");
    fs.mkdirSync(debugDir, { recursive: true });
    const safePrefix = filePrefix.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
    fs.writeFileSync(
      path.join(debugDir, `${safePrefix}-${Date.now()}.json`),
      JSON.stringify(payload, null, 2),
    );
  } catch (error) {
    console.error("Failed to write Yespo debug file:", error);
  }
}
