import type { FC } from "react";
import {
  BlockStack,
  Text,
  Link,
  Box,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { CheckCircleIcon, XCircleIcon } from "@shopify/polaris-icons";
import { Trans, useTranslation } from "react-i18next";

export interface ConnectionStatusListProps {
  isApiKeyActive?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
  supportLink: string;
  apiKeysLink: string;
}

const ConnectionStatusList: FC<ConnectionStatusListProps> = ({
  isApiKeyActive,
  isGeneralScriptExist,
  isWebPushScriptExist,
  isAppExtensionActive,
  supportLink,
  apiKeysLink,
}) => {
  const { t } = useTranslation();

  const isScriptsActive =
    isApiKeyActive &&
    isGeneralScriptExist &&
    isWebPushScriptExist &&
    isAppExtensionActive &&
    isAppExtensionActive;

  return (
    <BlockStack gap="150">
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <Box>
          <Icon
            source={isApiKeyActive ? CheckCircleIcon : XCircleIcon}
            tone={isApiKeyActive ? "textSuccess" : "textCritical"}
          />
        </Box>
        <Text as="p">
          <Trans
            i18nKey="ConnectionStatusSection.list.first"
            t={t}
            components={{
              apiKeysLink: <Link url={apiKeysLink} target="_blank" />,
            }}
          />
        </Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <Box>
          <Icon
            source={isScriptsActive ? CheckCircleIcon : XCircleIcon}
            tone={isScriptsActive ? "textSuccess" : "textCritical"}
          />
        </Box>
        <Text as="p">{t("ConnectionStatusSection.list.second")}</Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <Box>
          <Icon
            source={isScriptsActive ? CheckCircleIcon : XCircleIcon}
            tone={isScriptsActive ? "textSuccess" : "textCritical"}
          />
        </Box>
        <Text as="p">{t("ConnectionStatusSection.list.third")}</Text>
      </InlineStack>
      <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
        <Text as="p">
          <Trans
            i18nKey="ConnectionStatusSection.list.more"
            t={t}
            components={{
              supportLink: <Link url={supportLink} target="_blank" />,
              detailedLink: <Link url={supportLink} target="_blank" />,
            }}
          />
        </Text>
      </InlineStack>
    </BlockStack>
  );
};

export default ConnectionStatusList;
