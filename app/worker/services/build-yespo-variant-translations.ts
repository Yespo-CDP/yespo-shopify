import type { ProductTranslation } from "~/@types/product";
import type { ProductVariant, YespoCategory } from "~/@types/productVariant";
import { appendVariantParam } from "~/worker/services/append-variant-param";
import { primaryLanguageCategoryTranslations } from "~/worker/services/map-yespo-categories";

type YespoTranslations = NonNullable<ProductVariant["translations"]>;

/**
 * Builds the Yespo `translations` array for a single variant.
 *
 * Collection categories come from the locale translation. A taxonomy category
 * already present on the locale is kept. Taxonomy categories that the locale
 * does not have are copied from the primary-language payload. Returns
 * `undefined` when there are no product translations, so the field is omitted.
 */
export const buildYespoVariantTranslations = ({
  productTranslations,
  variantTranslationsByLocale,
  variantId,
  variantTitle,
  primaryCategories,
}: {
  productTranslations: Record<string, ProductTranslation> | null | undefined;
  /** locale → translated variant title for this variant */
  variantTranslationsByLocale?: Record<string, string>;
  variantId: string;
  variantTitle: string;
  primaryCategories: YespoCategory[];
}): YespoTranslations | undefined => {
  if (!productTranslations || Object.keys(productTranslations).length === 0) {
    return undefined;
  }

  return Object.entries(productTranslations).map(([locale, t]) => {
    // Use translated variant title if available for this variant + locale,
    // otherwise fall back to the original variant option title.
    const translatedVariantTitle =
      variantTranslationsByLocale?.[locale] ?? variantTitle;

    const localeCategoryIds = new Set(
      (t.categories ?? [])
        .map((category) => category.id)
        .filter((id): id is string => Boolean(id)),
    );
    const localeCategories = [
      ...(t.categories ?? []),
      ...primaryLanguageCategoryTranslations(primaryCategories).filter(
        (category) => !category.id || !localeCategoryIds.has(category.id),
      ),
    ];

    return {
      [locale]: {
        ...t,
        url: t.url ? appendVariantParam(t.url, variantId) : t.url,
        name: t.name
          ? translatedVariantTitle
            ? `${t.name} - ${translatedVariantTitle}`
            : t.name
          : undefined,
        ...(localeCategories.length > 0
          ? { categories: localeCategories }
          : {}),
      },
    };
  });
};
