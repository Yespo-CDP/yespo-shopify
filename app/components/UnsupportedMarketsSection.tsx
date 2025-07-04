import type { FC } from "react";
import { Banner, BlockStack, Button } from "@shopify/polaris";
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
    <Banner title={t("UnsupportedMarketsSection.title")} tone="warning">
      <BlockStack inlineAlign="start" gap="200">
        {t("UnsupportedMarketsSection.description")}
        <Button variant="primary" url="shopify://admin/settings/markets">
          {t("UnsupportedMarketsSection.button")}
        </Button>
      </BlockStack>
    </Banner>
  );
};

export default UnsupportedMarketsSection;
