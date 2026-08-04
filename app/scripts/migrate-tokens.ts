import { enqueueTokenMigration } from "~/services/queue";

/**
 * One-time trigger for the offline token migration. Enqueues a migration job per
 * shop; the running worker (npm run worker) processes the "token-migration"
 * queue. Safe to re-run — jobs are deduplicated and the migration is idempotent.
 *
 * Usage: npm run migrate:tokens
 */
const count = await enqueueTokenMigration();
console.log(`Enqueued ${count} shop(s) for offline token migration`);
process.exit(0);
