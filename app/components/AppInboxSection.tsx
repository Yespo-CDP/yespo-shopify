import { useCallback, useEffect, useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

export interface AppInboxSectionProps {
  disabled?: boolean;
  appInboxEnabled?: boolean;
}

const AppInboxSection: FC<AppInboxSectionProps> = ({
                                                     disabled,
                                                     appInboxEnabled = false,
                                                   }) => {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSyncToggle = useCallback(
    (intent: "app-inbox-enable" | "app-inbox-disable") => {
      try {
        setIsSubmitting(true);
        fetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during app inbox ${intent.replace("app-inbox-", "")}:`,
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
                {t("AppInboxSection.title")}
              </h2>

              {appInboxEnabled ? (
                <s-badge tone="success">
                  {t("AppInboxSection.status.enabled")}
                </s-badge>
              ) : (
                <s-badge tone="critical">
                  {t("AppInboxSection.status.disabled")}
                </s-badge>
              )}
            </s-stack>
            <s-text>{t("AppInboxSection.description")}</s-text>
          </s-stack>

          {appInboxEnabled ? (
            <s-button
              variant="primary"
              tone="critical"
              onClick={() => handleSyncToggle("app-inbox-disable")}
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("AppInboxSection.disable")}
            </s-button>
          ) : (
            <s-button
              variant="primary"
              onClick={() => handleSyncToggle("app-inbox-enable")}
              loading={isSubmitting}
              disabled={disabled || isSubmitting}
            >
              {t("AppInboxSection.enable")}
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </s-section>
  );
};

export default AppInboxSection;
