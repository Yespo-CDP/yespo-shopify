import { useCallback, type FC } from "react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { useFetcher } from "@remix-run/react";

export interface ContactSyncSectionProps {
  disabled?: boolean;
  contactSyncEnabled?: boolean;
}

const ContactSyncSection: FC<ContactSyncSectionProps> = ({
  disabled,
  contactSyncEnabled = false,
}) => {
  const { t } = useTranslation();
  const fetcher = useFetcher();

  const handleTrackingToggle = useCallback(
    (intent: "contact-sync-enable" | "contact-sync-disable") => {
      try {
        fetcher.submit({ intent }, { method: "post" });
      } catch (error) {
        console.error(
          `Error during web tracking ${intent.replace("tracking-", "")}:`,
          error,
        );
      }
    },
    [fetcher],
  );

  return (
    <Card>
      <InlineStack align={"space-between"} blockAlign={"baseline"}>
        <BlockStack>
          <InlineStack align={"start"} gap="200">
            <Text as="h2" variant="headingMd">
              {t("ContactSyncSection.title")}
            </Text>
            {contactSyncEnabled ? (
              <Badge tone="success" progress="complete">
                {t("ContactSyncSection.status.enabled")}
              </Badge>
            ) : (
              <Badge tone="critical" progress="incomplete">
                {t("ContactSyncSection.status.disabled")}
              </Badge>
            )}
          </InlineStack>
          <Text as={"span"}>{t("ContactSyncSection.description")}</Text>
        </BlockStack>

        {contactSyncEnabled ? (
          <Button
            size="large"
            variant="primary"
            tone="critical"
            onClick={() => handleTrackingToggle("contact-sync-disable")}
            loading={fetcher.state === "submitting"}
            disabled={disabled || fetcher.state === "submitting"}
          >
            {t("ContactSyncSection.disable")}
          </Button>
        ) : (
          <Button
            size="large"
            variant="primary"
            tone="success"
            onClick={() => handleTrackingToggle("contact-sync-enable")}
            loading={fetcher.state === "submitting"}
            disabled={disabled || fetcher.state === "submitting"}
          >
            {t("ContactSyncSection.enable")}
          </Button>
        )}
      </InlineStack>
    </Card>
  );
};

export default ContactSyncSection;
