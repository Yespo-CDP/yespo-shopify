import { useCallback, type FC } from "react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { useFetcher } from "@remix-run/react";

import type { CustomerSyncLog } from "~/@types/customerSyncLog";
import ContactSyncStatusBadge from "./ui/ContactSyncStatusBadge";

export interface DataSyncSectionProps {
  disabled?: boolean;
  contactSyncEnabled?: boolean;
  orderSyncEnabled?: boolean;
  customersSyncLog?: CustomerSyncLog;
}

const DataSyncSection: FC<DataSyncSectionProps> = ({
  disabled,
  customersSyncLog,
  orderSyncEnabled,
  contactSyncEnabled = false,
}) => {
  const { t } = useTranslation();
  const fetcher = useFetcher();

  const handleSyncToggle = useCallback(
    (intent: "data-sync-enable" | "data-sync-disable") => {
      try {
        fetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during data sync ${intent.replace("data-sync-", "")}:`,
          error,
        );
      }
    },
    [fetcher],
  );

  return (
    <Card>
      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="baseline">
          <BlockStack>
            <InlineStack align="start" gap="200">
              <Text as="h2" variant="headingMd">
                {t("DataSyncSection.title")}
              </Text>
              {contactSyncEnabled && orderSyncEnabled ? (
                <Badge tone="success" progress="complete">
                  {t("DataSyncSection.status.enabled")}
                </Badge>
              ) : (
                <Badge tone="critical" progress="incomplete">
                  {t("DataSyncSection.status.disabled")}
                </Badge>
              )}
            </InlineStack>
            <Text as="span">{t("DataSyncSection.description")}</Text>
          </BlockStack>

          {contactSyncEnabled && orderSyncEnabled ? (
            <Button
              size="large"
              variant="primary"
              tone="critical"
              onClick={() => handleSyncToggle("data-sync-disable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || fetcher.state === "submitting"}
            >
              {t("DataSyncSection.disable")}
            </Button>
          ) : (
            <Button
              size="large"
              variant="primary"
              tone="success"
              onClick={() => handleSyncToggle("data-sync-enable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || fetcher.state === "submitting"}
            >
              {t("DataSyncSection.enable")}
            </Button>
          )}
        </InlineStack>
        {contactSyncEnabled && customersSyncLog && (
          <BlockStack>
            <Text as="h2" variant="headingMd">
              {t("DataSyncSection.syncLog.title")}
            </Text>
            <InlineStack align="space-between">
              <Text as="span">
                {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                {customersSyncLog.syncedCount}
              </Text>
              <Text as="span">
                {t("DataSyncSection.syncLog.skippedCount")}:{" "}
                {customersSyncLog.skippedCount}
              </Text>
              <Text as="span">
                {t("DataSyncSection.syncLog.failedCount")}:{" "}
                {customersSyncLog.failedCount}
              </Text>
              <Text as="span">
                {t("DataSyncSection.syncLog.totalCount")}:{" "}
                {customersSyncLog.totalCount}
              </Text>
              <ContactSyncStatusBadge status={customersSyncLog?.status} />
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
};

export default DataSyncSection;
