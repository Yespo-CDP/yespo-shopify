import { useCallback, type FC } from "react";
import {
  Button,
  Banner,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  InlineError,
} from "@shopify/polaris";
import { Form, useRevalidator } from "@remix-run/react";
import { RefreshIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";
import ConnectionStatusList from "./ConnectionStatusList";

export interface ConnectionStatusSectionProps {
  isApiKeyActive?: boolean;
  isScriptActive?: boolean;
  isAppExtensionActive?: boolean;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const ConnectionStatusSection: FC<ConnectionStatusSectionProps> = ({
  isApiKeyActive,
  isScriptActive,
  isAppExtensionActive,
  errors,
  disabled,
}) => {
  const revalidator = useRevalidator();
  const { t } = useTranslation();

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
          isScriptActive={isScriptActive}
          isAppExtensionActive={isAppExtensionActive}
        />
        <InlineStack wrap={false} gap="100" blockAlign="center">
          <Box width="100%">
            {isApiKeyActive && isScriptActive && isAppExtensionActive ? (
              <Banner tone="success">
                {t("ConnectionStatusSection.banner.connected")}
              </Banner>
            ) : (
              <Banner tone="critical">
                {t("ConnectionStatusSection.banner.disconnected")}
              </Banner>
            )}
          </Box>
          <Form method="post" name="connection-status">
            <input type="hidden" name="intent" value="connection-status" />
            {isApiKeyActive && isScriptActive && isAppExtensionActive ? (
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
        {errors?.script && (
          <InlineError message={errors?.script} fieldID="fieldID" />
        )}
      </BlockStack>
    </Card>
  );
};

export default ConnectionStatusSection;
