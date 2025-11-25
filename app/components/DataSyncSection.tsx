import { useCallback, useEffect, useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

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
    <s-section>
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="baseline">
          <s-stack>
            <s-stack direction="inline" alignItems="start" gap="small-200">
              <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
                {t("DataSyncSection.title")}
              </h2>

              {contactSyncEnabled && orderSyncEnabled ? (
                <s-badge tone="success">
                  {t("DataSyncSection.status.enabled")}
                </s-badge>
              ) : (
                <s-badge tone="critical">
                  {t("DataSyncSection.status.disabled")}
                </s-badge>
              )}
            </s-stack>
            <s-text>{t("DataSyncSection.description")}</s-text>
          </s-stack>

          {contactSyncEnabled && orderSyncEnabled ? (
            <s-button
              variant="primary"
              tone="critical"
              onClick={() => handleSyncToggle("data-sync-disable")}
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("DataSyncSection.disable")}
            </s-button>
          ) : (
            <s-button
              variant="primary"
              onClick={() => handleSyncToggle("data-sync-enable")}
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("DataSyncSection.enable")}
            </s-button>
          )}
        </s-stack>

        {(contactSyncEnabled || orderSyncEnabled) && (
        <s-stack gap="small-200">
          <s-stack direction="inline" alignItems="center">
            <h3 style={{margin: 0, fontSize: '0.8125rem', fontWeight: 650}}>
              {t("DataSyncSection.title")}
            </h3>
            <DataSyncTooltip />
          </s-stack>
          {contactSyncEnabled && customersSyncLog && (
            <s-grid
              gridTemplateColumns="repeat(12, 1fr)"
              gap="small-100"
            >
              <s-grid-item gridColumn="span 3">
                <s-text type="strong">
                  {t("DataSyncSection.syncLog.customers")}:
                </s-text>
              </s-grid-item>
              <s-grid-item gridColumn="span 3">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                    {customersSyncLog.syncedCount +
                      customersSyncLog.skippedCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.failedCount")}:{" "}
                    {customersSyncLog.failedCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.totalCount")}:{" "}
                    {customersSyncLog.totalCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <DataSyncStatusBadge status={customersSyncLog?.status} />
                </s-stack>
              </s-grid-item>
            </s-grid>
          )}

          {orderSyncEnabled && orderSyncLog && (
            <s-grid
              gridTemplateColumns="repeat(12, 1fr)"
              gap="small-100"
            >
              <s-grid-item gridColumn="span 3">
                <s-text type="strong">
                  {t("DataSyncSection.syncLog.orders")}:
                </s-text>
              </s-grid-item>
              <s-grid-item gridColumn="span 3">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                    {orderSyncLog.syncedCount + orderSyncLog.skippedCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.failedCount")}:{" "}
                    {orderSyncLog.failedCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <s-text>
                    {t("DataSyncSection.syncLog.totalCount")}:{" "}
                    {orderSyncLog.totalCount}
                  </s-text>
                </s-stack>
              </s-grid-item>
              <s-grid-item gridColumn="span 2">
                <s-stack direction="inline" justifyContent="end">
                  <DataSyncStatusBadge status={orderSyncLog?.status} />
                </s-stack>
              </s-grid-item>
            </s-grid>
          )}
        </s-stack>
        )}
      </s-stack>
    </s-section>
  );
};

export default DataSyncSection;
