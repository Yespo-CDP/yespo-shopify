import getMarkets from "~/shopify/queries/get-markets.server";

/**
 * Checks if the shop has more than one active market enabled.
 *
 * Fetches up to 200 markets via the Shopify Admin API and determines
 * if more than one market is currently enabled.
 *
 * @param {Object} params - The parameters object.
 * @param {any} params.admin - The Shopify Admin API client instance.
 *
 * @returns {Promise<boolean>} A promise that resolves to `true` if more than one market is active, otherwise `false`.
 *
 * @example
 * const isOverflowing = await checkMarketsService({ admin });
 */
const checkMarketsService = async ({
  admin,
}: {
  admin: any;
}): Promise<boolean> => {
  const markets = await getMarkets({ admin, count: 200 });
  const activeMarkets = markets.filter((market) => market.enabled);

  return activeMarkets.length > 1;
};

export default checkMarketsService;
