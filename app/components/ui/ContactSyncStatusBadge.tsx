import type { FC } from "react";
import { Badge } from "@shopify/polaris";

import type { CustomerSyncLog } from "~/@types/customerSyncLog";

interface ContactSyncStatusBadgeProps {
  status: CustomerSyncLog["status"];
}

const ContactSyncStatusBadge: FC<ContactSyncStatusBadgeProps> = ({
  status,
}) => {
  switch (status) {
    case "ERROR":
      return (
        <Badge tone="critical" progress="incomplete">
          Error
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge tone="info" progress="partiallyComplete">
          In progress
        </Badge>
      );
    case "COMPLETE":
      return (
        <Badge tone="success" progress="complete">
          Complete
        </Badge>
      );
    default:
      return <Badge progress="incomplete">Not started</Badge>;
  }
};

export default ContactSyncStatusBadge;
