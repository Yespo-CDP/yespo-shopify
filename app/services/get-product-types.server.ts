import getProductTypes from "~/shopify/queries/get-product-types.server";

interface GetProductTypesServiceParams {
  admin: any;
  count?: number;
}

export interface ProductTypeOption {
  value: string;
  label: string;
}

/**
 * Get all product types from Shopify using pagination
 * Loops through all pages until all types are fetched
 */
export const getAllProductTypesService = async ({
  admin,
  count = 250,
}: GetProductTypesServiceParams): Promise<string[]> => {
  const allTypes: string[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    while (hasNextPage) {
      // Fetch current page
      const result = await getProductTypes({
        admin,
        count,
        after: cursor,
      });

      // Add types from current page
      allTypes.push(...result.types);

      // Update pagination state
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor || null;

      console.log(
        `[getAllProductTypes] Fetched ${result.types.length} types, total: ${allTypes.length}, hasNextPage: ${hasNextPage}`
      );
    }

    console.log(
      `[getAllProductTypes] Completed. Total product types: ${allTypes.length}`
    );

    return allTypes;
  } catch (error) {
    console.error("[getAllProductTypes] Failed to fetch all product types:", error);
    return allTypes;
  }
};

/**
 * Get all product types as options array for UI components
 * Returns array of {value, label} objects
 */
export const getProductTypesOptionsService = async ({
  admin,
  count,
}: GetProductTypesServiceParams): Promise<ProductTypeOption[]> => {
  const productTypes = await getAllProductTypesService({
    admin,
    count,
  });

  // Map to {value, label} format for select/autocomplete components
  return productTypes.map((type) => ({
    value: type,
    label: type,
  }));
};
