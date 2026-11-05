export interface MarketVariantPrice {
  amount: string;
  currencyCode: string;
}

export interface StatusCartProduct {
  productKey: string;
  price: string;
  discount: string;
  quantity: number;
  price_currency_code?: string;
}

/**
 * Builds `StatusCart` products from `carts/update` line items.
 *
 * The cart webhook is not market-aware: `presentment_money` can arrive in the
 * shop currency even when the buyer sees another currency. When the market
 * price (from Admin `contextualPricing`) is in a different currency than the
 * webhook's presentment money, the market price wins and the per-unit discount
 * is scaled by the market/shop price ratio. Otherwise the webhook values are
 * kept as they are.
 */
export function buildStatusCartProducts(
  lineItems: any[],
  marketPrices: Map<string, MarketVariantPrice> = new Map(),
): StatusCartProduct[] {
  return lineItems.map((item) => {
    const presentment = item.price_set?.presentment_money;
    const shopMoney = item.price_set?.shop_money;
    const quantity = Number(item.quantity) || 1;
    const variantKey = String(item.variant_id ?? item.id);
    const market = marketPrices.get(variantKey);

    if (market && market.currencyCode !== presentment?.currency_code) {
      const shopUnitPrice = Number(
        shopMoney?.amount ?? item.original_price ?? item.price,
      );
      const marketUnitPrice = Number(market.amount);
      const ratio =
        shopUnitPrice > 0 && Number.isFinite(marketUnitPrice)
          ? marketUnitPrice / shopUnitPrice
          : 0;
      const shopUnitDiscount =
        Number(item.total_discount_set?.shop_money?.amount ?? item.total_discount) /
        quantity;

      return {
        productKey: item.id.toString(),
        price: market.amount,
        discount: (shopUnitDiscount * ratio || 0).toFixed(2),
        quantity: item.quantity,
        price_currency_code: market.currencyCode,
      };
    }

    const discountAmount =
      item.total_discount_set?.presentment_money?.amount ?? item.total_discount;
    return {
      productKey: item.id.toString(),
      price: presentment?.amount ?? item.price,
      discount: (Number(discountAmount) / quantity).toFixed(2),
      quantity: item.quantity,
      price_currency_code: presentment?.currency_code ?? shopMoney?.currency_code,
    };
  });
}
