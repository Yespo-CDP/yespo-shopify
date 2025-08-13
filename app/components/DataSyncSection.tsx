import { useCallback, type FC } from "react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Grid,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { useFetcher } from "@remix-run/react";

import type { CustomerSyncLog } from "~/@types/customerSyncLog";
import type { OrderSyncLog } from "~/@types/orderSyncLog";
import DataSyncStatusBadge from "./ui/DataSyncStatusBadge";

export interface DataSyncSectionProps {
  disabled?: boolean;
  contactSyncEnabled?: boolean;
  orderSyncEnabled?: boolean;
  customersSyncLog?: CustomerSyncLog;
  orderSyncLog?: OrderSyncLog;
}

const DataSyncSection: FC<DataSyncSectionProps> = ({
  disabled,
  customersSyncLog,
  orderSyncLog,
  orderSyncEnabled = false,
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
      <BlockStack gap="200">
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
        {(contactSyncEnabled || orderSyncEnabled) && (
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">
              {t("DataSyncSection.syncLog.title")}
            </Text>
            {contactSyncEnabled && customersSyncLog && (
              <Grid
                gap={{
                  xs: "10px",
                  sm: "10px",
                  md: "10px",
                  lg: "10px",
                  xl: "10px",
                }}
              >
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <Text as="span" variant="headingSm">
                    {t("DataSyncSection.syncLog.customers")}:
                  </Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {customersSyncLog.syncedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.skippedCount")}:{" "}
                      {customersSyncLog.skippedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {customersSyncLog.failedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {customersSyncLog.totalCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <DataSyncStatusBadge status={customersSyncLog?.status} />
                  </InlineStack>
                </Grid.Cell>
              </Grid>
            )}
            {orderSyncEnabled && orderSyncLog && (
              <Grid
                gap={{
                  xs: "10px",
                  sm: "10px",
                  md: "10px",
                  lg: "10px",
                  xl: "10px",
                }}
              >
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <Text as="span" variant="headingSm">
                    {t("DataSyncSection.syncLog.orders")}:
                  </Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {orderSyncLog.syncedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.skippedCount")}:{" "}
                      {orderSyncLog.skippedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {orderSyncLog.failedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {orderSyncLog.totalCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <DataSyncStatusBadge status={orderSyncLog?.status} />
                  </InlineStack>
                </Grid.Cell>
              </Grid>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
};

export default DataSyncSection;
