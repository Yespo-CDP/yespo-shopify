import { useCallback, useState, type FC } from "react";
import {
  Button,
  Card,
  TextField,
  Text,
  BlockStack,
  Link,
} from "@shopify/polaris";
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

  const handleValueChange = useCallback((value: string) => setValue(value), []);

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
            type="text"
            autoComplete="off"
            onChange={handleValueChange}
            helpText={
              !errors?.apiKey && (
                <p>
                  {t("AccountConnectionSection.helpText")}{" "}
                  <Link
                    url="https://docs.yespo.io/reference/api-keys"
                    target="_blank"
                  >
                    docs.yespo.io
                  </Link>
                </p>
              )
            }
            error={errors?.apiKey}
            disabled={disabled}
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
