import getMarkets from "~/shopify/queries/get-markets.server";

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
