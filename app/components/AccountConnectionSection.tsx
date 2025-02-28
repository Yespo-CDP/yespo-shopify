import { useCallback, useEffect, useState, type FC } from "react";
import {
  Button,
  Card,
  TextField,
  Text,
  BlockStack,
  Link,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { ViewIcon, HideIcon } from "@shopify/polaris-icons";
import { Form } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import type { Account } from "~/@types/account";

export interface AccountConnectionSectionProps {
  apiKey?: string;
  account?: Account | null;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const AccountConnectionSection: FC<AccountConnectionSectionProps> = ({
  apiKey,
  account,
  errors,
  disabled,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(apiKey || "");
  const [show, setShow] = useState(false);

  const handleValueChange = useCallback((value: string) => setValue(value), []);
  const handleShowChange = useCallback(() => setShow(!show), [show]);

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
                {t("AccountConnectionSection.helpText")}{" "}
                <Link url={t("AccountConnectionSection.link")} target="_blank">
                  docs.yespo.io
                </Link>
              </p>
            }
            error={errors?.apiKey}
            disabled={disabled}
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
              <Button size="large" variant="primary" disabled={disabled} submit>
                {apiKey
                  ? t("AccountConnectionSection.button.revalidate")
                  : t("AccountConnectionSection.button.validate")}
              </Button>
            }
          />
        </Form>
      </BlockStack>
    </Card>
  );
};

export default AccountConnectionSection;
