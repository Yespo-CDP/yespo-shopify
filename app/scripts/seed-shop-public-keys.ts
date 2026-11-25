import { enqueueShopPublicKeys } from "~/services/queue";

/**
 * Enqueues a job per active shop that has no key for signing event data; the
 * running worker (npm run worker) processes the "shop-public-key" queue. Safe to
 * re-run — shops that already have a key are skipped.
 *
 * Usage: npm run seed:shop-keys
 */
const count = await enqueueShopPublicKeys();
console.log(`Enqueued ${count} shop(s) for event key creation`);
process.exit(0);
