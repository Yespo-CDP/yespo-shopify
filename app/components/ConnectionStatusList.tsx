import type {FC} from "react";
import {Trans, useTranslation} from "react-i18next";

/**
 * Props for the ConnectionStatusList component.
 *
 * @property {boolean} [isApiKeyActive] - Indicates if the Yespo API key is active.
 * @property {boolean} [isGeneralScriptExist] - Indicates if the general script is installed.
 * @property {boolean} [isWebPushScriptExist] - Indicates if the web push script is installed.
 * @property {boolean} [isAppExtensionActive] - Indicates if the app extension is active.
 * @property {string} dockUrl - Base URL for the Dock documentation site.
 * @property {string} platformUrl - Base URL for the platform (used for API keys link).
 */
export interface ConnectionStatusListProps {
  isApiKeyActive?: boolean;
  isGeneralScriptExist?: boolean;
  isWebPushScriptExist?: boolean;
  isAppExtensionActive?: boolean;
  dockUrl: string;
  platformUrl: string;
}

/**
 * Displays the connection status list with icons indicating success or failure
 * for API key activity and script/app extension installation statuses.
 *
 * Each list item is accompanied by a message and relevant links to support or documentation.
 *
 * @param {ConnectionStatusListProps} props - Component properties.
 *
 * @returns {JSX.Element} The rendered list of connection status indicators.
 *
 * @example
 * <ConnectionStatusList
 *   isApiKeyActive={true}
 *   isGeneralScriptExist={true}
 *   isWebPushScriptExist={false}
 *   isAppExtensionActive={true}
 *   dockUrl="https://docs.example.com"
 *   platformUrl="https://platform.example.com"
 * />
 */
const ConnectionStatusList: FC<ConnectionStatusListProps> = ({
                                                               isApiKeyActive,
                                                               isGeneralScriptExist,
                                                               isWebPushScriptExist,
                                                               isAppExtensionActive,
                                                               dockUrl,
                                                               platformUrl,
                                                             }) => {
  const {t} = useTranslation();

  // const isScriptsActive =
  //   isApiKeyActive &&
  //   isGeneralScriptExist &&
  //   isWebPushScriptExist &&
  //   isAppExtensionActive &&
  //   isAppExtensionActive;

  return (
    <s-stack gap="small-100">
      <s-stack direction="inline" alignItems="start" gap="small-100">
        <s-paragraph>
          {t("ConnectionStatusSection.list.first")}
        </s-paragraph>
      </s-stack>
      <s-stack direction="inline" alignItems="start" gap="small-100">
        <s-paragraph>
          {t("ConnectionStatusSection.list.second")}
        </s-paragraph>
      </s-stack>

      <s-stack direction="inline" alignItems="start" gap="small-100">
        <s-text>
          <Trans
            i18nKey="ConnectionStatusSection.list.more"
            t={t}
            components={{
              supportLink: (
                <s-link href={`${dockUrl}/docs/what-is-yespo`} target="_blank"/>
              ),
              detailedLink: (
                <s-link href={`${dockUrl}/docs/integrating-with-shopify`} target="_blank"/>
              ),
            }}
          />
        </s-text>
      </s-stack>
    </s-stack>
  );
};

export default ConnectionStatusList;
