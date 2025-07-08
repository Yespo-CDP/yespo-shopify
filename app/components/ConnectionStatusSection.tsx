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

/**
 * Props for the ConnectionStatusSection component.
 *
 * @property {boolean} [isApiKeyActive] - Indicates if the Yespo API key is active.
 * @property {boolean} [isGeneralScriptExist] - Indicates if the general script is installed.
 * @property {boolean} [isWebPushScriptExist] - Indicates if the web push script is installed.
 * @property {boolean} [isAppExtensionActive] - Indicates if the app extension is active.
 * @property {string} dockUrl - Base URL for Dock documentation links.
 * @property {string} platformUrl - Base URL for the platform (used for links).
 * @property {{ [key: string]: string }} [errors] - Optional error messages keyed by error type.
 * @property {boolean} [disabled] - Whether the UI controls (buttons) are disabled.
 */
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

/**
 * Displays the connection status section showing the overall integration state,
 * including API key, scripts, and app extension status. Provides controls to refresh
 * the status and configure the integration if needed.
 *
 * Shows different banners based on the connection completeness:
 * - Success if all required parts are active.
 * - Warning if partially configured.
 * - Critical if disconnected.
 *
 * @param {ConnectionStatusSectionProps} props - Component properties.
 *
 * @returns {JSX.Element} The rendered connection status UI section.
 *
 * @example
 * <ConnectionStatusSection
 *   isApiKeyActive={true}
 *   isGeneralScriptExist={true}
 *   isWebPushScriptExist={false}
 *   isAppExtensionActive={true}
 *   dockUrl="https://docs.example.com"
 *   platformUrl="https://platform.example.com"
 *   errors={{ script: "Script loading failed." }}
 *   disabled={false}
 * />
 */
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
