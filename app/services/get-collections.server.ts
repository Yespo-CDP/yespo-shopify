import getCollections, {
  GetCollectionsResult,
} from "~/shopify/queries/get-collections.server";

interface GetCollectionsServiceParams {
  admin: any;
  // Number of collections per page
  limit?: number;
  // Cursor for next page
  after?: string | null;
  // Cursor for previous page
  before?: string | null;
  // Search query
  query?: string;
}

export const getCollectionsService = async ({
  admin,
  limit,
  after,
  before,
  query,
}: GetCollectionsServiceParams): Promise<GetCollectionsResult> => {
  // map limit -> count for underlying query
  const count = typeof limit === "number" && limit > 0 ? limit : 10;

  return getCollections({
    admin,
    count,
    after: after ?? null,
    before: before ?? null,
    query: query ?? null,
  });
};
