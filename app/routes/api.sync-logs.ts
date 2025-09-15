import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import {
  customerSyncLogRepository,
  orderSyncLogRepository,
} from "~/repositories/repositories.server";

/**
 * Handles GET requests to receive synchronization data.
 *
 * This function is designed to obtain information about the state of data synchronization
 *
 * @async
 * @function action
 * @param {ActionFunctionArgs} args - The Remix action function arguments, including the HTTP request.
 * @returns {Promise<Response>} A response indicating success or failure of the operation.
 *
 * @throws {Error} Returns HTTP 401 if the request signature is invalid.
 *
 * @example
 * // Send GET request to this endpoint:
 * GET /api/sync-logs
 * 
 * const res = await fetch("/api/sync-logs");
 * const updated = await res.json();
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const customersSyncLog =
    await customerSyncLogRepository.getCustomerSyncLogByShop(session.shop);

  const orderSyncLog = await orderSyncLogRepository.getOrderSyncLogByShop(
    session.shop,
  );

  return { customersSyncLog, orderSyncLog };
}
