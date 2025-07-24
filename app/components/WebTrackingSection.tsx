import {Badge, BlockStack, Button, Card, InlineStack, Text} from "@shopify/polaris";
import {useTranslation} from "react-i18next";
import {useFetcher} from "@remix-run/react";
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
    isWebPushScriptExist &&
    isAppExtensionActive;

  const handleTrackingToggle = useCallback(
    (intent: "tracking-enable" | "tracking-disable") => {
      try {
        fetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(`Error during web tracking ${intent.replace("tracking-", "")}:`, error);
      }
    },
    [fetcher]
  );

  return (
    <Card>
      <InlineStack align={'space-between'} blockAlign={'baseline'}>
        <BlockStack>
          <InlineStack align={'start'} gap="200">
            <Text as="h2" variant="headingMd">
              {t("WebTrackingSection.title")}
            </Text>
            {webTrackerEnabled && isScriptsActive ? (
              <Badge tone="success" progress="complete">
                {t("WebTrackingSection.status.enabled")}
              </Badge>
            ) : (
              <Badge tone="critical" progress="incomplete">
                {t("WebTrackingSection.status.disabled")}
              </Badge>
            )}
          </InlineStack>
          <Text as={'span'}>
            {t("WebTrackingSection.description")}
          </Text>
        </BlockStack>

        {
          webTrackerEnabled && isScriptsActive ? (
            <Button
              size="large"
              variant="primary"
              tone="critical"
              onClick={() => handleTrackingToggle("tracking-disable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || fetcher.state === "submitting"}
            >
              {t("WebTrackingSection.disable")}
            </Button>
          ) : (
            <Button
              size="large"
              variant="primary"
              tone="success"
              onClick={() => handleTrackingToggle("tracking-enable")}
              loading={fetcher.state === "submitting"}
              disabled={disabled || !isScriptsActive || fetcher.state === "submitting"}
            >
              {t("WebTrackingSection.enable")}
            </Button>
          )
        }
      </InlineStack>

    </Card>
  )
}

export default WebTrackingSection;
