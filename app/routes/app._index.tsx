import {
  useActionData,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import {
  Page,
  Layout,
  BlockStack,
  Text,
  Image,
  InlineStack,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

import UnsupportedMarketsSection from "~/components/UnsupportedMarketsSection";
import AccountConnectionSection from "~/components/AccountConnectionSection";
import ConnectionStatusSection from "~/components/ConnectionStatusSection";
import UsefulLinksSection from "~/components/UsefulLinksSection";
import { loaderHandler, actionHandler } from "~/lib/app.server";

export const loader = loaderHandler;
export const action = actionHandler;

export default function Index() {
  const { t } = useTranslation();
  const shopify = useAppBridge();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { shop, isMarketsOverflowing, scriptConnectionStatus } = loaderData;
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = revalidator.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success?.apiKey) {
      shopify.toast.show(t("AccountConnectionSection.success"), {
        duration: 2000,
      });
    } else if (actionData?.success?.connection?.ok) {
      if (!actionData?.success?.connection?.isThemeExtensionActive) {
        window.open(
          `https://${shopify.config.shop}/admin/themes/current/editor?context=apps`,
          "_blank",
        );
      }
      shopify.toast.show(t("ConnectionStatusSection.success"), {
        duration: 2000,
      });
    } else if (Object.values(actionData?.errors ?? {}).length > 0) {
      const error = Object.values(actionData?.errors ?? {})[0];
      shopify.toast.show(error, {
        duration: 2000,
        isError: true,
      });
    }
  }, [actionData, shopify, t]);

  return (
    <Page>
      <BlockStack gap="500">
        <Layout>
          {isMarketsOverflowing && (
            <Layout.Section>
              <UnsupportedMarketsSection />
            </Layout.Section>
          )}
          <Layout.Section>
            <BlockStack gap="300">
              <InlineStack gap="300" blockAlign="center">
                <Image source="./logo.png" alt="logo" height={48} />
                <Text as="h1" variant="heading3xl" fontWeight="medium">
                  {t("WelcomeSection.title")}
                </Text>
              </InlineStack>
              <Text as="p">{t("WelcomeSection.description")}</Text>
            </BlockStack>
          </Layout.Section>
          <Layout.Section>
            <AccountConnectionSection
              apiKey={shop?.apiKey ?? ""}
              errors={actionData?.errors}
              disabled={isMarketsOverflowing || isSubmitting || isLoading}
            />
          </Layout.Section>
          <Layout.Section>
            <ConnectionStatusSection
              isScriptActive={scriptConnectionStatus.isActive}
              errors={actionData?.errors}
              disabled={
                isMarketsOverflowing ||
                isSubmitting ||
                isLoading ||
                !shop?.apiKey
              }
            />
          </Layout.Section>
          <Layout.Section>
            <UsefulLinksSection />
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
