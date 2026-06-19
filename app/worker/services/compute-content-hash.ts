import { createHash } from "node:crypto";

export function computeContentHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
