import type {LoaderFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {getCollectionsService} from "~/services/get-collections.server";
import {getProductTypesOptionsService} from "~/services/get-product-types.server";
import {getCategoriesOptionsService} from "~/services/get-categories.server";

export const categoryPageLoaderHandler = async({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const limitParam = searchParams.get("limit");
  const after = searchParams.get("after");

  const limit = limitParam ? Number(limitParam) : undefined;

  // Fetch collections with pagination
  const collectionsResult = await getCollectionsService({
    admin,
    limit,
    after,
  });

  // Fetch all product types and categories in parallel
  const [productTypes, categories] = await Promise.all([
    getProductTypesOptionsService({ admin }),
    getCategoriesOptionsService({ admin }),
  ]);

  return {
    collections: collectionsResult.collections,
    pageInfo: collectionsResult.pageInfo,
    limit: limit ?? 50,
    productTypes,
    categories,
  };
}
