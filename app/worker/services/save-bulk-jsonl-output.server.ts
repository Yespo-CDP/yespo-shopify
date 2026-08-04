import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "output", "market-sync");

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function getBulkJsonlOutputPath(
  shop: string,
  batchId: string,
): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const shopSlug = sanitizeFilePart(shop);
  const batchSlug = sanitizeFilePart(batchId);

  return path.join(OUTPUT_DIR, `${shopSlug}_${batchSlug}.jsonl`);
}

export function createBulkJsonlOutputWriter(outputPath: string) {
  return createWriteStream(outputPath, { flags: "w" });
}
