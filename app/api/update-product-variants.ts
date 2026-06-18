import type {
  ProductVariant,
  ProductVariantsResponse,
} from "~/@types/productVariant";

/**
 * Temporary stub for the Yespo product variants API.
 *
 * Replace with a real HTTP call to `${process.env.API_URL}/product-variants` once the Yespo endpoint is available.
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {ProductVariant[]} params.productVariants - The product variant array to sync.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 * @returns {Promise<ProductVariantsResponse>} A promise that resolves with a mock success response.
 */
export const updateProductVariants = async ({
  apiKey,
  productVariants,
  domain,
  orgId,
}: {
  apiKey: string;
  productVariants: ProductVariant[];
  domain: string;
  orgId?: number | null;
}): Promise<ProductVariantsResponse> => {
  return {
    id: Date.now(),
    failedVariants: [],
  };
};
