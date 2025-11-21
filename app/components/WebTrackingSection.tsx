import {useTranslation} from "react-i18next";
import {useFetcher} from "react-router";
import {useCallback} from "react";

export interface WebTrackingSectionProps {
  disabled?: boolean;
  webTrackerEnabled?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
}

const WebTrackingSection = ({
                              disabled,
                              webTrackerEnabled = false,
                              isGeneralScriptExist,
                              isWebPushScriptExist,
                              isAppExtensionActive
                            }: WebTrackingSectionProps) => {
  const {t} = useTranslation();
  const fetcher = useFetcher();

  const isScriptsActive =
    isGeneralScriptExist &&
    isAppExtensionActive;

  const handleTrackingToggle = useCallback(
    (intent: "tracking-enable" | "tracking-disable") => {
      try {
        fetcher.submit({intent}, {method: "post"});
      } catch (error) {
        console.error(`Error during web tracking ${intent.replace("tracking-", "")}:`, error);
      }
    },
    [fetcher]
  );

  return (
    <s-section>
      <s-stack direction="inline" justifyContent="space-between" alignItems="baseline">
        <s-stack>
          <s-stack direction="inline" gap="small-200">
            <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
              {t("WebTrackingSection.title")}
            </h2>

            {webTrackerEnabled && isScriptsActive ? (
              <s-badge tone="success">
                {t("WebTrackingSection.status.enabled")}
              </s-badge>
            ) : (
              <s-badge tone="critical">
                {t("WebTrackingSection.status.disabled")}
              </s-badge>
            )}
          </s-stack>
          <s-text>
            {t("WebTrackingSection.description")}
          </s-text>
        </s-stack>

        {
          webTrackerEnabled && isScriptsActive ? (
            <s-button
              variant="primary"
              tone="critical"
              onClick={() => handleTrackingToggle("tracking-disable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || fetcher.state === "submitting"}
            >
              {t("WebTrackingSection.disable")}
            </s-button>
          ) : (
            <s-button
              variant="primary"
              onClick={() => handleTrackingToggle("tracking-enable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || !isScriptsActive || fetcher.state === "submitting"}
            >
              {t("WebTrackingSection.enable")}
            </s-button>
          )
        }
      </s-stack>
    </s-section>
  )
}

export default WebTrackingSection;
