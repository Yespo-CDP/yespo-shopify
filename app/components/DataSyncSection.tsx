import { useCallback, useEffect, useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

import type { CustomerSyncLog } from "~/@types/customerSyncLog";
import type { OrderSyncLog } from "~/@types/orderSyncLog";
// import type { MarketSyncLogRecord } from "~/@types/marketSyncLog";
import DataSyncStatusBadge from "./ui/DataSyncStatusBadge";
import DataSyncTooltip from "./ui/DataSyncTooltip";
import { ProductVariantSyncLog } from "~/@types/productVariantSyncLog";

export interface DataSyncSectionProps {
  disabled?: boolean;
  customersSyncLog?: CustomerSyncLog;
  orderSyncLog?: OrderSyncLog;
  productVariantSyncLog?: ProductVariantSyncLog;
  // marketSyncLogs?: MarketSyncLogRecord[];
  contactSyncEnabled?: boolean;
  orderSyncEnabled?: boolean;
  productVariantSyncEnabled?: boolean;
}

const DataSyncSection: FC<DataSyncSectionProps> = ({
  disabled,
  customersSyncLog,
  orderSyncLog,
  productVariantSyncLog,
  // marketSyncLogs = [],
  orderSyncEnabled = false,
  contactSyncEnabled = false,
  productVariantSyncEnabled = false,
}) => {
  const { t } = useTranslation();
  const customersOrdersFetcher = useFetcher();
  const productsFetcher = useFetcher();
  const [isCustomersOrdersSubmitting, setIsCustomersOrdersSubmitting] =
    useState(false);
  const [isProductSubmitting, setIsProductSubmitting] = useState(false);

  const customersOrdersEnabled = contactSyncEnabled && orderSyncEnabled;

  const handleCustomersOrdersToggle = useCallback(
    (intent: "customers-orders-sync-enable" | "customers-orders-sync-disable") => {
      try {
        setIsCustomersOrdersSubmitting(true);
        customersOrdersFetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during customers/orders sync ${intent.replace("customers-orders-sync-", "")}:`,
          error,
        );
        setIsCustomersOrdersSubmitting(false);
      }
    },
    [customersOrdersFetcher],
  );

  const handleProductToggle = useCallback(
    (intent: "products-sync-enable" | "products-sync-disable") => {
      try {
        setIsProductSubmitting(true);
        productsFetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during product sync ${intent.replace("products-sync-", "")}:`,
          error,
        );
        setIsProductSubmitting(false);
      }
    },
    [productsFetcher],
  );

  useEffect(() => {
    if (customersOrdersFetcher.state === "idle") {
      setIsCustomersOrdersSubmitting(false);
    }
  }, [customersOrdersFetcher.state]);

  useEffect(() => {
    if (productsFetcher.state === "idle") {
      setIsProductSubmitting(false);
    }
  }, [productsFetcher.state]);

  return (
    <s-section>
      <s-stack gap="base">
        <s-stack>
          <s-stack direction="inline" alignItems="center" gap="small-200">
            <h2 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 650 }}>
              {t("DataSyncSection.title")}
            </h2>
            <DataSyncTooltip />
          </s-stack>
          <s-text>{t("DataSyncSection.description")}</s-text>
        </s-stack>

        <s-stack gap="small-200">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="end"
          >
            <s-stack direction="inline" alignItems="end" gap="small-200">
              <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 650 }}>
                {t("DataSyncSection.customersAndOrdersTitle")}
              </h3>

              {customersOrdersEnabled ? (
                <s-badge tone="success">
                  {t("DataSyncSection.status.enabled")}
                </s-badge>
              ) : (
                <s-badge tone="critical">
                  {t("DataSyncSection.status.disabled")}
                </s-badge>
              )}
            </s-stack>

            {customersOrdersEnabled ? (
              <s-button
                variant="primary"
                tone="critical"
                onClick={() => handleCustomersOrdersToggle("customers-orders-sync-disable")}
                loading={isCustomersOrdersSubmitting}
                disabled={disabled || isCustomersOrdersSubmitting}
              >
                {t("DataSyncSection.disable")}
              </s-button>
            ) : (
              <s-button
                variant="primary"
                onClick={() => handleCustomersOrdersToggle("customers-orders-sync-enable")}
                loading={isCustomersOrdersSubmitting}
                disabled={disabled || isCustomersOrdersSubmitting}
              >
                {t("DataSyncSection.enable")}
              </s-button>
            )}
          </s-stack>

          {customersOrdersEnabled && (
            <s-stack gap="small-200">
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
            </s-stack>
          )}
        </s-stack>

        <s-stack gap="small-200">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="end"
          >
            <s-stack direction="inline" alignItems="end" gap="small-200">
              <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 650 }}>
                {t("DataSyncSection.productSyncTitle")}
              </h3>

              {productVariantSyncEnabled ? (
                <s-badge tone="success">
                  {t("DataSyncSection.status.enabled")}
                </s-badge>
              ) : (
                <s-badge tone="critical">
                  {t("DataSyncSection.status.disabled")}
                </s-badge>
              )}
            </s-stack>

            {productVariantSyncEnabled ? (
              <s-button
                variant="primary"
                tone="critical"
                onClick={() => handleProductToggle("products-sync-disable")}
                loading={isProductSubmitting}
                disabled={disabled || isProductSubmitting}
              >
                {t("DataSyncSection.disable")}
              </s-button>
            ) : (
              <s-button
                variant="primary"
                onClick={() => handleProductToggle("products-sync-enable")}
                loading={isProductSubmitting}
                disabled={disabled || isProductSubmitting}
              >
                {t("DataSyncSection.enable")}
              </s-button>
            )}
          </s-stack>

          {productVariantSyncEnabled && (
            <s-stack gap="small-200">
              {productVariantSyncLog && (
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
              {/* Market sync logs are temporarily hidden
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
              */}
            </s-stack>
          )}
        </s-stack>
      </s-stack>
    </s-section>
  );
};

export default DataSyncSection;
