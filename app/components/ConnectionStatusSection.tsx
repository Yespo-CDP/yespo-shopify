import { type FC } from "react";
import {
  Button,
  Banner,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineError,
  Link,
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
  dockUrl: string;
  platformUrl: string;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const ConnectionStatusSection: FC<ConnectionStatusSectionProps> = ({
  isApiKeyActive,
  isGeneralScriptExist,
  isWebPushScriptExist,
  isAppExtensionActive,
  dockUrl,
  platformUrl,
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
          dockUrl={dockUrl}
          platformUrl={platformUrl}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ flex: 1 }}>
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
          </div>
          <Form method="post" name={intent}>
            <input type="hidden" name="intent" value={intent} />
            {(!isApiKeyActive ||
              !isGeneralScriptExist ||
              !isWebPushScriptExist ||
              !isAppExtensionActive) && (
              <Button
                size="large"
                variant="primary"
                disabled={disabled}
                submit
              >
                {t("ConnectionStatusSection.button.configure")}
              </Button>
            )}
          </Form>
        </div>
        {errors?.script && (
          <InlineError
            message={
              <BlockStack>
                <Text as="p">{errors.script}</Text>
                <InlineStack gap="100">
                  <Text as="p">
                    {t("ConnectionStatusSection.errors.support")}
                  </Text>
                  <Link url={`${dockUrl}/docs/what-is-yespo`} target="_blank">
                    {`${dockUrl}/docs/what-is-yespo`}
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
