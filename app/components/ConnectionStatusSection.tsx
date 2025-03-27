import { type FC } from "react";
import {
  Button,
  Banner,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineError,
  Box,
  Link,
} from "@shopify/polaris";
import { Form, useRevalidator } from "@remix-run/react";
import { RefreshIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";
import ConnectionStatusList from "./ConnectionStatusList";

const SUPPORT_LINK =
  process.env.SUPPORT_LINK ?? "https://docs.yespo.io/docs/what-is-yespo";

export interface ConnectionStatusSectionProps {
  isApiKeyActive?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const ConnectionStatusSection: FC<ConnectionStatusSectionProps> = ({
  isApiKeyActive,
  isGeneralScriptExist,
  isWebPushScriptExist,
  isAppExtensionActive,
  errors,
  disabled,
}) => {
  const revalidator = useRevalidator();
  const { t } = useTranslation();
  const intent = "connection-status";

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
        <InlineStack
          wrap={false}
          gap="100"
          blockAlign="center"
          align="space-between"
        >
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
            {(!isApiKeyActive ||
              !isGeneralScriptExist ||
              !isWebPushScriptExist ||
              !isAppExtensionActive) && (
              <Box width="115px">
                <Button
                  size="large"
                  variant="primary"
                  disabled={disabled}
                  submit
                >
                  {t("ConnectionStatusSection.button.configure")}
                </Button>
              </Box>
            )}
          </Form>
        </InlineStack>
        {errors?.script && (
          <InlineError
            message={
              <BlockStack>
                <Text as="p">{errors.script}</Text>
                <InlineStack gap="100">
                  <Text as="p">
                    {t("ConnectionStatusSection.errors.support")}
                  </Text>
                  <Link url={SUPPORT_LINK} target="_blank">
                    {SUPPORT_LINK}
                  </Link>
                </InlineStack>
              </BlockStack>
            }
            fieldID="fieldID"
          />
        )}
      </BlockStack>
    </Card>
  );
};

export default ConnectionStatusSection;
