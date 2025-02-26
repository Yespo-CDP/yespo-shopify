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

export interface ConnectionStatusSectionProps {
  isScriptActive?: boolean;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const ConnectionStatusSection: FC<ConnectionStatusSectionProps> = ({
  isScriptActive,
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
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {t("ConnectionStatusSection.title")}
        </Text>
        <Text as="p" variant="bodyMd">
          {t("ConnectionStatusSection.helpText")}
        </Text>
        <InlineStack wrap={false} gap="100" blockAlign="center">
          <Box width="100%">
            {isScriptActive ? (
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
            {isScriptActive ? (
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
          <Button
            size="large"
            variant="primary"
            onClick={() => revalidator.revalidate()}
            disabled={disabled}
            icon={RefreshIcon}
          />
        </InlineStack>
        {errors?.script && (
          <InlineError message={errors?.script} fieldID="fieldID" />
        )}
      </BlockStack>
    </Card>
  );
};

export default ConnectionStatusSection;
