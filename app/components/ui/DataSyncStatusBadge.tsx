import type { FC } from "react";

import type { SyncLogStatus } from "~/@types/customerSyncLog";
import { useTranslation } from "react-i18next";

/**
 * Props for the DataSyncStatusBadge component.
 *
 * @property {SyncLogStatus} [status] - Data sync status.
 */
interface DataSyncStatusBadgeProps {
  status: SyncLogStatus;
}

/**
 * DataSyncStatusBadge component displays the sync status badge.
 *
 * @param {DataSyncStatusBadgeProps} props - Component props.
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @example
 * <DataSyncStatusBadge
 *   status="IN_PROGRESS"
 * />
 */
const DataSyncStatusBadge: FC<DataSyncStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();

  switch (status) {
    case "ERROR":
      return (
        <s-badge tone="critical" >
          {t("DataSyncSection.statusBadge.error")}
        </s-badge>
      );
    case "IN_PROGRESS":
      return (
        <s-badge tone="info">
          {t("DataSyncSection.statusBadge.inProgress")}
        </s-badge>
      );
    case "COMPLETE":
      return (
        <s-badge tone="success">
          {t("DataSyncSection.statusBadge.complete")}
        </s-badge>
      );
    default:
      return <s-badge>{t("DataSyncSection.statusBadge.notStarted")}</s-badge>;
  }
};

export default DataSyncStatusBadge;
