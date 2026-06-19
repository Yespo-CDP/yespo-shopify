import { useCallback, useEffect, useState, type FC } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

import type { CustomerSyncLog } from "~/@types/customerSyncLog";
import type { OrderSyncLog } from "~/@types/orderSyncLog";
import type { MarketSyncLogRecord } from "~/@types/marketSyncLog";
import DataSyncStatusBadge from "./ui/DataSyncStatusBadge";
import DataSyncTooltip from "./ui/DataSyncTooltip";
import { ProductVariantSyncLog } from "~/@types/productVariantSyncLog";

export interface DataSyncSectionProps {
  disabled?: boolean;
  customersSyncLog?: CustomerSyncLog;
  orderSyncLog?: OrderSyncLog;
  productVariantSyncLog?: ProductVariantSyncLog;
  marketSyncLogs?: MarketSyncLogRecord[];
  contactSyncEnabled?: boolean;
  orderSyncEnabled?: boolean;
  productVariantSyncEnabled?: boolean;
  onMarketSyncTriggered?: () => void;
}

const DataSyncSection: FC<DataSyncSectionProps> = ({
  disabled,
  customersSyncLog,
  orderSyncLog,
  productVariantSyncLog,
  marketSyncLogs = [],
  orderSyncEnabled = false,
  contactSyncEnabled = false,
  productVariantSyncEnabled = false,
  onMarketSyncTriggered,
}) => {
  const { t } = useTranslation();
  const shopify = useAppBridge();
  const fetcher = useFetcher();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarketSyncSubmitting, setIsMarketSyncSubmitting] = useState(false);

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

  const handleMarketSync = useCallback(async () => {
    setIsMarketSyncSubmitting(true);

    try {
      const response = await fetch("/api/market-sync-cron", { method: "POST" });
      const data = (await response.json()) as {
        success?: boolean;
        enqueued?: number;
        message?: string;
      };

      if (response.ok && data.success) {
        shopify.toast.show(
          t("DataSyncSection.marketSync.success", {
            count: data.enqueued ?? 0,
          }),
          { duration: 3000 },
        );
        onMarketSyncTriggered?.();
        return;
      }

      shopify.toast.show(
        data.message ?? t("DataSyncSection.marketSync.error"),
        {
          duration: 3000,
          isError: true,
        },
      );
    } catch (error) {
      console.error("Market sync cron trigger failed:", error);
      shopify.toast.show(t("DataSyncSection.marketSync.error"), {
        duration: 3000,
        isError: true,
      });
    } finally {
      setIsMarketSyncSubmitting(false);
    }
  }, [onMarketSyncTriggered, shopify, t]);

  return (
    <s-section>
      <s-stack gap="small-200">
        <s-stack
          direction="inline"
          justifyContent="space-between"
          alignItems="baseline"
        >
          <s-stack>
            <s-stack direction="inline" alignItems="start" gap="small-200">
              <h2 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 650 }}>
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
              <h3 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 650 }}>
                {t("DataSyncSection.title")}
              </h3>
              <DataSyncTooltip />
            </s-stack>
            {contactSyncEnabled && customersSyncLog && (
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="small-100">
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
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="small-100">
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
            {productVariantSyncEnabled && productVariantSyncLog && (
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="small-100">
                <s-grid-item gridColumn="span 3">
                  <s-text type="strong">
                    {t("DataSyncSection.syncLog.productVariants")}:
                  </s-text>
                </s-grid-item>
                <s-grid-item gridColumn="span 3">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {productVariantSyncLog.syncedCount +
                        productVariantSyncLog.skippedCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {productVariantSyncLog.failedCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {productVariantSyncLog.totalCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <DataSyncStatusBadge
                      status={productVariantSyncLog?.status}
                    />
                  </s-stack>
                </s-grid-item>
              </s-grid>
            )}
            {marketSyncLogs.map((marketSyncLog) => (
              <s-grid
                key={marketSyncLog.countryCode}
                gridTemplateColumns="repeat(12, 1fr)"
                gap="small-100"
              >
                <s-grid-item gridColumn="span 3">
                  <s-text type="strong">
                    {t("DataSyncSection.syncLog.productsByCountry", {
                      countryCode: marketSyncLog.countryCode,
                    })}
                    :
                  </s-text>
                </s-grid-item>
                <s-grid-item gridColumn="span 3">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.syncedCount")}:{" "}
                      {marketSyncLog.syncedCount + marketSyncLog.skippedCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.failedCount")}:{" "}
                      {marketSyncLog.failedCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <s-text>
                      {t("DataSyncSection.syncLog.totalCount")}:{" "}
                      {marketSyncLog.totalCount}
                    </s-text>
                  </s-stack>
                </s-grid-item>
                <s-grid-item gridColumn="span 2">
                  <s-stack direction="inline" justifyContent="end">
                    <DataSyncStatusBadge status={marketSyncLog.status} />
                  </s-stack>
                </s-grid-item>
              </s-grid>
            ))}
          </s-stack>
        )}

        <s-stack direction="inline" justifyContent="end">
          <s-button
            variant="secondary"
            onClick={handleMarketSync}
            loading={isMarketSyncSubmitting}
            disabled={isMarketSyncSubmitting || isSubmitting}
          >
            {t("DataSyncSection.marketSync.trigger")}
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
};

export default DataSyncSection;
