import { useCallback, type FC } from "react";
import {
  Button,
  Banner,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { Form, useRevalidator } from "@remix-run/react";
import { RefreshIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";
import ConnectionStatusList from "./ConnectionStatusList";

export interface ConnectionStatusSectionProps {
  isApiKeyActive?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
  disabled?: boolean;
}

const ConnectionStatusSection: FC<ConnectionStatusSectionProps> = ({
  isApiKeyActive,
  isGeneralScriptExist,
  isWebPushScriptExist,
  isAppExtensionActive,
  disabled,
}) => {
  const revalidator = useRevalidator();
  const { t } = useTranslation();
  const intent = "connection-status";

  const handleDisconect = useCallback(() => {
    window.open(
      `https://${shopify.config.shop}/admin/themes/current/editor?context=apps`,
      "_blank",
    );
  }, []);

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="200">
          <Text as="h2" variant="headingMd">
            {t("ConnectionStatusSection.title")}
          </Text>
          <Button
            icon={RefreshIcon}
            size="micro"
            variant="plain"
            onClick={() => revalidator.revalidate()}
            disabled={disabled}
          >
            {t("ConnectionStatusSection.refresh")}
          </Button>
        </InlineStack>
        <ConnectionStatusList
          isApiKeyActive={isApiKeyActive}
          isGeneralScriptExist={isGeneralScriptExist}
          isWebPushScriptExist={isWebPushScriptExist}
          isAppExtensionActive={isAppExtensionActive}
        />
        <InlineStack wrap={false} gap="100" blockAlign="center">
          <Box width="100%">
            {isApiKeyActive &&
            isGeneralScriptExist &&
            isWebPushScriptExist &&
            isAppExtensionActive ? (
              <Banner tone="success">
                {t("ConnectionStatusSection.banner.connected")}
              </Banner>
            ) : isApiKeyActive &&
              isAppExtensionActive &&
              (isGeneralScriptExist || isWebPushScriptExist) ? (
              <Banner tone="warning">
                {t("ConnectionStatusSection.banner.incomplete")}
              </Banner>
            ) : (
              <Banner tone="critical">
                {t("ConnectionStatusSection.banner.disconnected")}
              </Banner>
            )}
          </Box>
          <Form method="post" name={intent}>
            <input type="hidden" name="intent" value={intent} />
            {isApiKeyActive &&
            isGeneralScriptExist &&
            isWebPushScriptExist &&
            isAppExtensionActive ? (
              <Button
                size="large"
                variant="primary"
                tone="critical"
                disabled={disabled}
                onClick={handleDisconect}
              >
                {t("ConnectionStatusSection.button.disconnect")}
              </Button>
            ) : (
              <Button
                size="large"
                variant="primary"
                tone="success"
                disabled={disabled}
                submit
              >
                {t("ConnectionStatusSection.button.connect")}
              </Button>
            )}
          </Form>
        </InlineStack>
      </BlockStack>
    </Card>
  );
};

export default ConnectionStatusSection;
