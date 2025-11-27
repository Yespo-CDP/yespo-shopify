import type {LoaderFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {getCategoriesOptionsService} from "~/services/get-categories.server";

/**
 * API endpoint for searching categories dynamically
 */
export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";

  // console.log('[api.search-categories] Search term:', search);

  // Fetch categories with search filter
  const categories = await getCategoriesOptionsService({
    admin,
    search,
  });

  // console.log('[api.search-categories] Found categories:', categories.length);
  // console.log('[api.search-categories] First 3 categories:', categories.slice(0, 3));

  return {categories};
};

