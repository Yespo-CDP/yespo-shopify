import type { FC } from "react";
import { useTranslation } from "react-i18next";

/**
 * UnsupportedMarketsSection component displays a warning banner
 * informing the user about unsupported markets in their Shopify store.
 *
 * It includes a description and a button linking to Shopify's markets settings page.
 *
 * @returns {JSX.Element} The warning banner UI element.
 *
 * @example
 * <UnsupportedMarketsSection />
 */
const UnsupportedMarketsSection: FC = () => {
  const { t } = useTranslation();
  return (
    <s-banner heading={t("UnsupportedMarketsSection.title")} tone="warning" dismissible>
     <s-stack justifyContent="start" gap="small-200">
       {t("UnsupportedMarketsSection.description")}
       <s-button href="shopify://admin/settings/markets" variant="primary">
         {t("UnsupportedMarketsSection.button")}
       </s-button>
     </s-stack>
    </s-banner>
  );
};

export default UnsupportedMarketsSection;
