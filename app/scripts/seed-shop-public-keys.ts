import { enqueueShopPublicKeys } from "~/services/queue";

/**
 * Enqueues a job per active shop that has no key for signing event data; the
 * running worker (npm run worker) processes the "shop-public-key" queue. Safe to
 * re-run — shops that already have a key are skipped.
 *
 * Usage: npm run seed:shop-keys
 */
// Without Redis the queue waits forever (maxRetriesPerRequest: null) and the web
// process would never start, so give up after 15 s.
setTimeout(() => {
  console.error("seed:shop-keys timed out after 15 s");
  process.exit(1);
}, 15_000).unref();

const count = await enqueueShopPublicKeys();
console.log(`Enqueued ${count} shop(s) for event key creation`);
process.exit(0);
