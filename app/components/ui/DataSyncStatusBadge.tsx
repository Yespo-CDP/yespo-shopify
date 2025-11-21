import type { FC } from "react";

import type { SyncLogStatus } from "~/@types/customerSyncLog";

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
  switch (status) {
    case "ERROR":
      return (
        <s-badge tone="critical" >
          Error
        </s-badge>
      );
    case "IN_PROGRESS":
      return (
        <s-badge tone="info">
          In progress
        </s-badge>
      );
    case "COMPLETE":
      return (
        <s-badge tone="success">
          Complete
        </s-badge>
      );
    default:
      return <s-badge>Not started</s-badge>;
  }
};

export default DataSyncStatusBadge;
