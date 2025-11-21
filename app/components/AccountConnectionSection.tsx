import {useCallback, useEffect, useState, type FC} from "react";
import {Form, useFetcher} from "react-router";
import {Trans, useTranslation} from "react-i18next";

import type {Account} from "~/@types/account";

/**
 * Props for the AccountConnectionSection component.
 *
 * @property {string} [apiKey] - The current Yespo API key for the connected account.
 * @property {Account | null} [account] - The account information object, or null if not connected.
 * @property {{ [key: string]: string }} [errors] - Validation or server errors keyed by field name.
 * @property {boolean} [disabled] - Whether the form inputs and buttons are disabled.
 */
export interface AccountConnectionSectionProps {
  apiKey?: string;
  account?: Account | null;
  errors?: { [key: string]: string };
  disabled?: boolean;
  platformUrl?: string;
}

/**
 * AccountConnectionSection component allows users to connect or disconnect their account via Yespo API key.
 *
 * Displays the connection status, account details (if connected), an API key input with show/hide toggle,
 * and buttons to connect or disconnect the account. Includes a confirmation modal before disconnecting.
 *
 * @param {AccountConnectionSectionProps} props - Component props.
 *
 * @returns {JSX.Element} The rendered component.
 *
 * @example
 * <AccountConnectionSection
 *   apiKey="abcdef123456"
 *   account={accountData}
 *   errors={{ apiKey: "Invalid API key" }}
 *   disabled={false}
 * />
 */

const AccountConnectionSection: FC<AccountConnectionSectionProps> = ({
   apiKey,
   account,
   errors,
   disabled,
   platformUrl
}) => {
  const {t} = useTranslation();
  const fetcher = useFetcher();
  const [value, setValue] = useState(apiKey || "")

  const handleValueChange = useCallback((value: string) => setValue(value), []);

  const handleDisconnect = useCallback(() => {
    try {
      fetcher.submit({intent: "account-disconnection"}, {method: "post"});
    } catch (error) {
      console.error("Error during account disconnection:", error);
    }
  }, [fetcher]);

  useEffect(() => {
    setValue(apiKey || "");
  }, [apiKey]);

  return (
    <>
      <s-section>
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small-200">
            <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
              {t("AccountConnectionSection.title")}
            </h2>
            {account ? (
              <s-badge tone="success">
                {t("AccountConnectionSection.status.active")}
              </s-badge>
            ) : (
              <s-badge tone="critical">
                {t("AccountConnectionSection.status.inactive")}
              </s-badge>
            )}
          </s-stack>
          {account?.organisationName && (
            <s-stack direction="inline" gap="small-300">
              <s-text> {t("AccountConnectionSection.account")}:</s-text>
              <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
                {account?.organisationName}
              </h2>
            </s-stack>
          )}

          <Form method="post" name="account-connection">
            <input type="hidden" name="intent" value="account-connection"/>
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
                <s-grid-item>
                  <s-password-field
                    value={value}
                    name="apiKey"
                    label="Api Key"
                    autocomplete="off"
                    onChange={(e) => handleValueChange(e.currentTarget.value)}
                    error={errors?.apiKey}
                    disabled={disabled}
                  />
                </s-grid-item>
                <s-grid-item>
                  <s-box paddingBlockStart="large">
                    {account ? (
                      <s-button
                        variant="primary"
                        tone="critical"
                        commandFor="disconnect-modal"
                        loading={fetcher.state === "submitting"}
                        disabled={disabled || fetcher.state === "submitting"}
                      >
                        {t("AccountConnectionSection.button.disconnect")}
                      </s-button>
                    ) : (
                      <s-button
                        variant="primary"
                        type="submit"
                        loading={fetcher.state === "submitting"}
                        disabled={disabled || !!apiKey}
                      >
                        {t("AccountConnectionSection.button.connect")}
                      </s-button>
                    )}
                  </s-box>
                </s-grid-item>
              </s-grid>

              <s-paragraph>
                <Trans
                  i18nKey="AccountConnectionSection.connectText"
                  t={t}
                  components={{
                    fullAccessLink: (
                      <s-link
                        href={t("AccountConnectionSection.link")}
                        target="_blank"
                      />
                    ),
                    apiKeysLink: (
                      <s-link
                        href={`${platformUrl}/settings-ui/#/api-keys-list`}
                        target="_blank"
                      />
                    ),
                  }}
                />
              </s-paragraph>
            </s-stack>

          </Form>
        </s-stack>
      </s-section>

      <s-modal id="disconnect-modal" heading="Disconnect account">
        <s-paragraph>Are you sure you want to disable your account?</s-paragraph>
        <s-button slot="secondary-actions" commandFor="disconnect-modal" command="--hide">
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          commandFor="disconnect-modal"
          command="--hide"
          onClick={handleDisconnect}
        >
          Confirm
        </s-button>
      </s-modal>
    </>
  );
};

export default AccountConnectionSection;
