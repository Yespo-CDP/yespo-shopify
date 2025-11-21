import type { FC } from "react";
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
    <>
      <s-tooltip id="data-sync-tooltip">
        <s-paragraph>
          <s-text >
            <b>{t("DataSyncSection.syncLog.syncedCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.synchronized")}
          </s-text>
          <br/>
          <s-text>
            <b>{t("DataSyncSection.syncLog.failedCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.failed")}
          </s-text>
          <br/>
          <s-text>
            <b>{t("DataSyncSection.syncLog.totalCount")}:</b>{" "}
            {t("DataSyncSection.tooltip.total")}
          </s-text>
        </s-paragraph>

      </s-tooltip>
      <s-button interestFor="data-sync-tooltip" accessibilityLabel="Bold" variant={'tertiary'}>
        <s-icon type="question-circle" />
      </s-button>
    </>
  );
};

export default DataSyncTooltip;
