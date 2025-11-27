import getCategories from "~/shopify/queries/get-categories.server";

interface Category {
  id: string;
  level: number;
  name: string;
  fullName: string;
  childrenIds: string[];
}

interface GetCategoriesServiceParams {
  admin: any;
  count?: number;
  search?: string;
}

export interface CategoryOption {
  value: string;
  label: string;
}

/**
 * Get all categories from Shopify using pagination
 * Loops through all pages until all categories are fetched
 */
export const getAllCategoriesService = async ({
  admin,
  count = 250,
  search = '',
}: GetCategoriesServiceParams): Promise<Category[]> => {
  const allCategories: Category[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    while (hasNextPage) {
      // Fetch current page
      const result = await getCategories({
        admin,
        count,
        after: cursor,
        search,
      });

      // Add categories from current page
      allCategories.push(...result.categories);

      // Update pagination state
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor || null;

      console.log(
        `[getAllCategories] Fetched ${result.categories.length} categories, total: ${allCategories.length}, hasNextPage: ${hasNextPage}`
      );
    }

    console.log(
      `[getAllCategories] Completed. Total categories: ${allCategories.length}`
    );

    return allCategories;
  } catch (error) {
    console.error("[getAllCategories] Failed to fetch all categories:", error);
    return allCategories;
  }
};

/**
 * Get all categories as options array for UI components
 * Returns array of {value, label} objects
 */
export const getCategoriesOptionsService = async ({
  admin,
  count,
  search,
}: GetCategoriesServiceParams): Promise<CategoryOption[]> => {
  const categories = await getAllCategoriesService({
    admin,
    count,
    search,
  });

  // Map to {value, label} format for select/autocomplete components
  return categories.map((category) => ({
    value: category.id,
    label: category.fullName,
  }));
};

