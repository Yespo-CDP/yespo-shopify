import { useCallback, type FC } from "react";
import {
  BlockStack,
  InlineStack,
  Icon,
  Text,
  Box,
  Button,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  SettingsIcon,
  XCircleIcon,
} from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";

export interface ConnectionStatusListProps {
  isApiKeyActive?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
}

const ConnectionStatusList: FC<ConnectionStatusListProps> = ({
  isApiKeyActive,
  isGeneralScriptExist,
  isWebPushScriptExist,
  isAppExtensionActive,
}) => {
  const { t } = useTranslation();

  const handleExtensionConfig = useCallback(() => {
    window.open(
      `https://${shopify.config.shop}/admin/themes/current/editor?context=apps`,
      "_blank",
    );
  }, []);

  return (
    <BlockStack gap="150">
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <div>
          <Icon
            source={isApiKeyActive ? CheckCircleIcon : XCircleIcon}
            tone={isApiKeyActive ? "textSuccess" : "textCritical"}
          />
        </div>
        <Text
          as="p"
          variant="bodyXs"
          tone={isApiKeyActive ? "subdued" : "base"}
        >
          {t("ConnectionStatusSection.list.apiKey")}
        </Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <div>
          <Icon
            source={isGeneralScriptExist ? CheckCircleIcon : XCircleIcon}
            tone={isGeneralScriptExist ? "textSuccess" : "textCritical"}
          />
        </div>
        <Text
          as="p"
          variant="bodyXs"
          tone={isGeneralScriptExist ? "subdued" : "base"}
        >
          {t("ConnectionStatusSection.list.generalScript")}
        </Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <div>
          <Icon
            source={isWebPushScriptExist ? CheckCircleIcon : XCircleIcon}
            tone={isWebPushScriptExist ? "textSuccess" : "textCritical"}
          />
        </div>
        <Text
          as="p"
          variant="bodyXs"
          tone={isGeneralScriptExist ? "subdued" : "base"}
        >
          {t("ConnectionStatusSection.list.webpushScript")}
        </Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <Box>
          <Icon
            source={isAppExtensionActive ? CheckCircleIcon : XCircleIcon}
            tone={isAppExtensionActive ? "textSuccess" : "textCritical"}
          />
        </Box>
        <Text
          as="p"
          variant="bodyXs"
          tone={isAppExtensionActive ? "subdued" : "base"}
        >
          {t("ConnectionStatusSection.list.extension")}
        </Text>
        <Button
          variant="plain"
          icon={SettingsIcon}
          onClick={handleExtensionConfig}
        />
      </InlineStack>
    </BlockStack>
  );
};

export default ConnectionStatusList;
