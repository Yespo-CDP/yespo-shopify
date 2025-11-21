import type {FC} from "react";
import {useTranslation} from "react-i18next";
import {Form} from "react-router";

/**
 * Props for the ScriptStatusBanner component.
 *
 * Defines the data required to display the installation status of a script
 * along with success and error messages.
 *
 * @interface ScriptStatusBannerProps
 *
 * @property {boolean} scriptInstalled - Indicates whether the script is installed.
 * @property {string} successMessage - The message displayed when the script is successfully installed.
 * @property {string} errorMessage - The message displayed when the script installation fails.
 */

interface ScriptStatusBannerProps {
  scriptInstalled: boolean;
  successMessage: string;
  errorMessage: string;
  intentName: string;
}

/**
 * ScriptStatusBanner component displays the current installation status
 * of a script and provides feedback to the user.
 *
 * - If the script is installed, it shows a success banner.
 * - If not installed, it shows an error banner and a "Try again" button.
 *
 * @component
 * @example
 * ```tsx
 * <ScriptStatusBanner
 *   scriptInstalled={true}
 *   successMessage="Script successfully installed!"
 *   errorMessage="Script installation failed."
 * />
 * ```
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.scriptInstalled - Indicates whether the script is installed.
 * @param {string} props.successMessage - Message displayed when the script is installed.
 * @param {string} props.errorMessage - Message displayed when the script is not installed.
 *
 * @returns {JSX.Element} A banner with installation status and optional retry button.
 */

const ScriptStatusBanner: FC<ScriptStatusBannerProps> = ({
  scriptInstalled,
  successMessage,
  errorMessage,
  intentName
}) => {
  const {t} = useTranslation();

  return (
    <>
      {
        scriptInstalled ? (
          <s-banner tone="success">
            {successMessage}
          </s-banner>
        ) : (
          <s-stack gap="base" direction="inline" alignItems="center">
            <div style={{flex: 1}}>
              <s-banner tone="critical">
                {errorMessage}
              </s-banner>
            </div>

            <Form method="post" name={intentName}>
              <input type="hidden" name="intent" value={intentName}/>
              <s-button
                variant="primary"
                type="submit"
              >
                {t("ConnectionStatusSection.button.tryAgain")}
              </s-button>
            </Form>
          </s-stack>
        )
      }
    </>
  );
};

export default ScriptStatusBanner;
