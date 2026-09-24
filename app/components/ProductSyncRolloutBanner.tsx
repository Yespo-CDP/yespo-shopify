import { useState, type FC } from "react";
import { useFetcher } from "react-router";
import { useTranslation } from "react-i18next";

interface ProductSyncRolloutBannerProps {
  pending?: boolean;
}

/**
 * Shown once after product sync is turned on for an existing shop.
 * Dismissing it persists on the shop and does not turn sync off.
 */
const ProductSyncRolloutBanner: FC<ProductSyncRolloutBannerProps> = ({
  pending = false,
}) => {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [dismissed, setDismissed] = useState(false);

  if (!pending || dismissed) {
    return null;
  }

  return (
    <s-banner
      heading={t("DataSyncSection.rolloutNotice.heading")}
      tone="info"
      dismissible
      onDismiss={() => {
        setDismissed(true);
        fetcher.submit(
          { intent: "dismiss-product-sync-notice" },
          { method: "post" },
        );
      }}
    >
      {t("DataSyncSection.rolloutNotice.description")}
    </s-banner>
  );
};

export default ProductSyncRolloutBanner;
