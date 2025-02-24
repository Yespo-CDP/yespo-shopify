import type { FC } from "react";
import { Banner, BlockStack, Button } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

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
