/**
 * Yespo (Jackson) serializes a one-element `items` list as a single object
 * instead of a one-element array:
 * `{ items: { productId, status } }` vs `{ items: [{ productId, status }] }`.
 */
export const normalizeYespoItems = <T>(items: T | T[] | null | undefined): T[] => {
  if (items == null) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
};
