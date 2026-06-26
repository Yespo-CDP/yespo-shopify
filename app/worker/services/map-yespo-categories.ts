import type { YespoCategory } from "~/@types/productVariant";

export interface ShopifyCollectionNode {
  id: string;
  title: string;
  handle?: string;
}

export interface ShopifyTaxonomyCategory {
  id: string;
  name: string;
  fullName: string;
}

/**
 * Fallback category used when a product has no collections and no taxonomy
 * category. Yespo requires at least one category on `action: "create"`, so an
 * empty `categories` array would cause the request to be rejected.
 */
export const DEFAULT_YESPO_CATEGORY: YespoCategory = {
  name: "Uncategorized",
  type: "category",
};

/**
 * Guarantees a non-empty `categories` array by falling back to
 * {@link DEFAULT_YESPO_CATEGORY} when no real categories are present.
 */
export const withDefaultCategory = (
  categories: YespoCategory[],
): YespoCategory[] =>
  categories.length > 0 ? categories : [DEFAULT_YESPO_CATEGORY];

/** Extracts the numeric id from a Shopify GID, e.g. "gid://shopify/Collection/123" → "123". */
const stripGid = (gid: string): string => gid.split("/").pop() ?? gid;

/**
 * Maps Shopify collections to Yespo category objects.
 * Shopify collections are flat (no hierarchy), so they map to type "collection".
 */
export const mapCollectionsToYespoCategories = (
  nodes?: ShopifyCollectionNode[] | null,
): YespoCategory[] =>
  (nodes ?? []).map((node) => ({
    id: stripGid(node.id),
    name: node.title,
    type: "collection" as const,
  }));

/**
 * Maps a Shopify standard taxonomy category to a hierarchical Yespo category
 * with `type: "category"`. The `path` is derived from Shopify's `fullName`
 * breadcrumb, e.g. "Apparel > Clothing > Tops" → ["Apparel", "Clothing", "Tops"].
 *
 * Returns `null` when the product has no taxonomy category.
 */
export const mapTaxonomyCategoryToYespoCategory = (
  category?: ShopifyTaxonomyCategory | null,
): YespoCategory | null => {
  if (!category) return null;

  const path = category.fullName
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    id: stripGid(category.id),
    name: category.name,
    ...(path.length > 0 ? { path } : {}),
    type: "category" as const,
  };
};

/**
 * Builds the full Yespo `categories` array from a product's Shopify collections
 * and its standard taxonomy category. Shared by both the bulk sync and webhook
 * flows so they produce identical category payloads.
 */
export const mapShopifyCategories = ({
  collections,
  category,
}: {
  collections?: ShopifyCollectionNode[] | null;
  category?: ShopifyTaxonomyCategory | null;
}): YespoCategory[] => {
  const categories = mapCollectionsToYespoCategories(collections);
  const taxonomyCategory = mapTaxonomyCategoryToYespoCategory(category);
  if (taxonomyCategory) {
    categories.push(taxonomyCategory);
  }
  return categories;
};
