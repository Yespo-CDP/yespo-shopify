import {type FC} from "react";
import {Form, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import ConnectionStatusList from "./ConnectionStatusList";
import ScriptStatusBanner from "~/components/ui/ScriptStatusBanner";

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
  isGeneralScriptExist = false,
  isWebPushScriptExist = false,
  isAppExtensionActive,
  dockUrl,
  platformUrl,
  errors,
  disabled,
}) => {
  const revalidator = useRevalidator();
  const {t} = useTranslation();
  const intent = "connection-status";

  return (
    <s-section>
      <s-stack gap="small-300">
        <s-stack direction="inline" gap="small-400" alignItems="center">
          <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
            {t("ConnectionStatusSection.title")}
          </h2>
          <s-button
            icon="refresh"
            onClick={() => revalidator.revalidate()}
            disabled={disabled}
            variant="tertiary"
            accessibilityLabel='refresh-button'
          >
            {t("ConnectionStatusSection.refresh")}
          </s-button>
        </s-stack>

        <ConnectionStatusList
          isApiKeyActive={isApiKeyActive}
          isGeneralScriptExist={isGeneralScriptExist}
          isWebPushScriptExist={isWebPushScriptExist}
          isAppExtensionActive={isAppExtensionActive}
          dockUrl={dockUrl}
          platformUrl={platformUrl}
        />
        {
          isApiKeyActive && (
            <s-stack gap={"base"}>
              <ScriptStatusBanner
                scriptInstalled={isGeneralScriptExist}
                errorMessage={t("ConnectionStatusSection.banner.generalScriptError")}
                successMessage={isAppExtensionActive ? t("ConnectionStatusSection.banner.generalScriptInstalled") : t("ConnectionStatusSection.banner.generalScriptReady")}
                intentName={'retry-install-general-script'}
              />

              <ScriptStatusBanner
                scriptInstalled={isWebPushScriptExist}
                errorMessage={t("ConnectionStatusSection.banner.webPushScriptError")}
                successMessage={isAppExtensionActive ? t("ConnectionStatusSection.banner.webPushScriptInstalled") : t("ConnectionStatusSection.banner.webPushScriptReady")}
                intentName={'retry-install-webpush-script'}
              />
            </s-stack>
          )
        }
      </s-stack>

      <s-stack alignItems="end" justifyContent="end" paddingBlockStart="small-100">
        <Form method="post" name={intent}>
          <input type="hidden" name="intent" value={intent}/>
          {(!isApiKeyActive ||
            !isAppExtensionActive) && (
            <s-button
              variant="primary"
              disabled={disabled}
              type="submit"
            >
              {t("ConnectionStatusSection.button.activateThemeExtension")}
            </s-button>
          )}
        </Form>
      </s-stack>
      {errors?.script && (
        <s-stack direction="inline" gap="small-400">
          <s-icon type="alert-circle" tone="critical"/>
          <s-stack gap="small-500">
            <s-paragraph tone="critical">
              {errors.script}
            </s-paragraph>
            <s-stack direction="inline" gap="small-400" >
              <s-paragraph tone="critical">
                {t("ConnectionStatusSection.errors.support")}
              </s-paragraph>

              <s-link href={`${dockUrl}/docs/what-is-yespo`} target="_blank">{`${dockUrl}/docs/what-is-yespo`}</s-link>
            </s-stack>
          </s-stack>
        </s-stack>
      )}
    </s-section>
  );
};

export default ConnectionStatusSection;
