import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Loader function that authenticates the admin user.
 *
 * @param {LoaderFunctionArgs} args - The loader arguments containing the request.
 * @returns {Promise<null>} Returns null after successful authentication.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};
