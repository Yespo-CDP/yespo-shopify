import type { FC } from "react";
import { Text, BlockStack, Tooltip, Icon } from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";

/**
 * DataSyncTooltip ui component to display the data synchronization tooltip.
 *
 * Displays a tooltip describing the data synchronization fields.
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @example
 * <DataSyncTooltip />
 */
const DataSyncTooltip: FC = () => {
  const { t } = useTranslation();

  return (
    <Tooltip
      width="wide"
      content={
        <BlockStack gap="200">
          <Text as="span" variant="bodyXs">
            <b>{t("DataSyncSection.syncLog.syncedCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.synchronized")}
          </Text>
          <Text as="span" variant="bodyXs">
            <b>{t("DataSyncSection.syncLog.skippedCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.skipped")}
          </Text>
          <Text as="span" variant="bodyXs">
            <b>{t("DataSyncSection.syncLog.failedCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.failed")}
          </Text>
          <Text as="span" variant="bodyXs">
            <b>{t("DataSyncSection.syncLog.totalCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.total")}
          </Text>
        </BlockStack>
      }
    >
      <Icon source={QuestionCircleIcon} />
    </Tooltip>
  );
};

export default DataSyncTooltip;
