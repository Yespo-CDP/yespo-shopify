type RestMoney = { amount?: string | null };

/**
 * Buyer-facing amount from a Shopify REST money set.
 * Falls back to the shop-currency scalar when presentment money is absent.
 */
export const presentmentAmount = (
  moneySet: { presentment_money?: RestMoney } | null | undefined,
  fallback: string | null | undefined,
): number =>
  parseFloat(moneySet?.presentment_money?.amount ?? fallback ?? "0");

type GraphMoney = { amount?: string | null };

/**
 * Buyer-facing amount from a Shopify GraphQL money bag.
 * Falls back to shop money when presentment money is absent.
 */
export const presentmentMoneyAmount = (
  moneyBag:
    | { presentmentMoney?: GraphMoney | null; shopMoney?: GraphMoney | null }
    | null
    | undefined,
): number =>
  parseFloat(
    moneyBag?.presentmentMoney?.amount ?? moneyBag?.shopMoney?.amount ?? "0",
  );
