import { useCallback, useEffect, useState, type FC } from "react";
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
import DataSyncTooltip from "./ui/DataSyncTooltip";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSyncToggle = useCallback(
    (intent: "data-sync-enable" | "data-sync-disable") => {
      try {
        setIsSubmitting(true);
        fetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during data sync ${intent.replace("data-sync-", "")}:`,
          error,
        );
        setIsSubmitting(false);
      }
    },
    [fetcher],
  );

  useEffect(() => {
    if (fetcher.state === "idle") {
      setIsSubmitting(false);
    }
  }, [fetcher.state]);

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
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("DataSyncSection.disable")}
            </Button>
          ) : (
            <Button
              size="large"
              variant="primary"
              tone="success"
              onClick={() => handleSyncToggle("data-sync-enable")}
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("DataSyncSection.enable")}
            </Button>
          )}
        </InlineStack>
        {(contactSyncEnabled || orderSyncEnabled) && (
          <BlockStack gap="200">
            <InlineStack>
              <Text as="h3" variant="headingSm">
                {t("DataSyncSection.syncLog.title")}
              </Text>
              <DataSyncTooltip />
            </InlineStack>
            {contactSyncEnabled && customersSyncLog && (
              <Grid
                gap={{
                  xs: "5px",
                  sm: "5px",
                  md: "5px",
                  lg: "10px",
                  xl: "10px",
                }}
                columns={{ xs: 4, sm: 4, md: 12, lg: 12, xl: 12 }}
              >
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                  <Text as="span" variant="headingSm">
                    {t("DataSyncSection.syncLog.customers")}:
                  </Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 3, lg: 3, xl: 3 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {customersSyncLog.syncedCount +
                        customersSyncLog.skippedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {customersSyncLog.failedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {customersSyncLog.totalCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
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
                columns={{ xs: 4, sm: 4, md: 12, lg: 12, xl: 12 }}
              >
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                  <Text as="span" variant="headingSm">
                    {t("DataSyncSection.syncLog.orders")}:
                  </Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 3, lg: 3, xl: 3 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {orderSyncLog.syncedCount + orderSyncLog.skippedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {orderSyncLog.failedCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
                  <InlineStack align="end">
                    <Text as="span">
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {orderSyncLog.totalCount}
                    </Text>
                  </InlineStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
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
