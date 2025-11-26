import getCollections, {
  GetCollectionsResult,
} from "~/shopify/queries/get-collections.server";

interface GetCollectionsServiceParams {
  admin: any;
  // Number of collections per page
  limit?: number;
  // Cursor for next page
  after?: string | null;
}

export const getCollectionsService = async ({
  admin,
  limit,
  after,
}: GetCollectionsServiceParams): Promise<GetCollectionsResult> => {
  // map limit -> count for underlying query
  const count = typeof limit === "number" && limit > 0 ? limit : 50;

  return getCollections({
    admin,
    count,
    after: after ?? null,
  });
};
