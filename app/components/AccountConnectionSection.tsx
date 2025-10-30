import { useCallback, useEffect, useState, type FC } from "react";
import { Modal, TitleBar } from "@shopify/app-bridge-react";
import {
  Button,
  Card,
  TextField,
  Text,
  BlockStack,
  Link,
  InlineStack,
  Badge,
  Box,
} from "@shopify/polaris";
import { ViewIcon, HideIcon } from "@shopify/polaris-icons";
import { Form, useFetcher } from "@remix-run/react";
import {Trans, useTranslation} from "react-i18next";

import type { Account } from "~/@types/account";

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
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [value, setValue] = useState(apiKey || "");
  const [show, setShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleValueChange = useCallback((value: string) => setValue(value), []);
  const handleShowChange = useCallback(() => setShow(!show), [show]);
  const handleModalOpen = useCallback(() => setModalOpen(true), []);
  const handleModalClose = useCallback(() => setModalOpen(false), []);

  const handleDisconnect = useCallback(() => {
    try {
      fetcher.submit({ intent: "account-disconnection" }, { method: "post" });
      setModalOpen(false);
    } catch (error) {
      console.error("Error during account disconnection:", error);
    }
  }, [fetcher]);

  useEffect(() => {
    setValue(apiKey || "");
  }, [apiKey]);

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200">
          <Text as="h2" variant="headingMd">
            {t("AccountConnectionSection.title")}
          </Text>
          {account ? (
            <Badge tone="success" progress="complete">
              {t("AccountConnectionSection.status.active")}
            </Badge>
          ) : (
            <Badge tone="critical" progress="incomplete">
              {t("AccountConnectionSection.status.inactive")}
            </Badge>
          )}
        </InlineStack>
        {account?.organisationName && (
          <InlineStack gap="100">
            <Text as="span" variant="bodyMd">
              {t("AccountConnectionSection.account")}:
            </Text>
            <Text as="h2" variant="headingMd">
              {account?.organisationName}
            </Text>
          </InlineStack>
        )}
        <Form method="post" name="account-connection">
          <input type="hidden" name="intent" value="account-connection" />
          <TextField
            value={value}
            name="apiKey"
            label="Api Key"
            type={show ? "text" : "password"}
            autoComplete="off"
            onChange={handleValueChange}
            helpText={
              <p>
                <Trans
                  i18nKey="AccountConnectionSection.connectText"
                  t={t}
                  components={{
                    fullAccessLink: (
                      <Link
                        url={t("AccountConnectionSection.link")}
                        target="_blank"
                      />
                    ),
                    apiKeysLink: (
                      <Link
                        url={`${platformUrl}/settings-ui/#/api-keys-list`}
                        target="_blank"
                      />
                    ),
                  }}
                />
              </p>
            }
            error={errors?.apiKey}
            disabled={disabled || !!apiKey}
            suffix={
              <InlineStack blockAlign="center">
                <Button
                  variant="plain"
                  disabled={disabled}
                  icon={show ? HideIcon : ViewIcon}
                  onClick={handleShowChange}
                />
              </InlineStack>
            }
            connectedRight={
              account ? (
                <Button
                  size="large"
                  variant="primary"
                  tone="critical"
                  onClick={handleModalOpen}
                  loading={fetcher.state === "submitting"}
                  disabled={disabled || fetcher.state === "submitting"}
                >
                  {t("AccountConnectionSection.button.disconnect")}
                </Button>
              ) : (
                <Button
                  size="large"
                  variant="primary"
                  loading={fetcher.state === "submitting"}
                  disabled={disabled || !!apiKey}
                  submit
                >
                  {t("AccountConnectionSection.button.connect")}
                </Button>
              )
            }
          />
        </Form>
      </BlockStack>
      <Modal open={modalOpen} onHide={() => setModalOpen(false)}>
        <Box paddingBlock="400" paddingInline="200">
          <Text as="p">Are you sure you want to disable your account?</Text>
        </Box>
        <TitleBar title="Disconnect account">
          <button
            variant="primary"
            tone="critical"
            disabled={disabled && fetcher.state === "submitting"}
            onClick={handleDisconnect}
          >
            Confirm
          </button>
          <button disabled={disabled} onClick={handleModalClose}>
            Cancel
          </button>
        </TitleBar>
      </Modal>
    </Card>
  );
};

export default AccountConnectionSection;
