import { useCallback, useEffect, useState, type FC } from "react";
import {
  Button,
  Card,
  TextField,
  Text,
  BlockStack,
  Link,
  InlineStack,
} from "@shopify/polaris";
import { ViewIcon, HideIcon } from "@shopify/polaris-icons";
import { Form } from "@remix-run/react";
import { useTranslation } from "react-i18next";

export interface AccountConnectionSectionProps {
  apiKey?: string;
  errors?: { [key: string]: string };
  disabled?: boolean;
}

const AccountConnectionSection: FC<AccountConnectionSectionProps> = ({
  apiKey,
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
        <Text as="h2" variant="headingMd">
          {t("AccountConnectionSection.title")}
        </Text>
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
              !errors?.apiKey && (
                <p>
                  {t("AccountConnectionSection.helpText")}{" "}
                  <Link
                    url={t("AccountConnectionSection.link")}
                    target="_blank"
                  >
                    docs.yespo.io
                  </Link>
                </p>
              )
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
