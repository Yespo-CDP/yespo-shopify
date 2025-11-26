import type {LoaderFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {getCollectionsService} from "~/services/get-collections.server";

export const categoryPageLoaderHandler = async({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const limitParam = searchParams.get("limit");
  const after = searchParams.get("after");

  const limit = limitParam ? Number(limitParam) : undefined;

  const collectionsResult = await getCollectionsService({
    admin,
    limit,
    after,
  });

  return {
    collections: collectionsResult.collections,
    pageInfo: collectionsResult.pageInfo,
    limit: limit ?? 50,
  };
}
