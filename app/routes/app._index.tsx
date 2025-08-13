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
  Box,
  Link,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Trans, useTranslation } from "react-i18next";
import { useEffect } from "react";

import UnsupportedMarketsSection from "~/components/UnsupportedMarketsSection";
import AccountConnectionSection from "~/components/AccountConnectionSection";
import ConnectionStatusSection from "~/components/ConnectionStatusSection";
import UsefulLinksSection from "~/components/UsefulLinksSection";
import { loaderHandler, actionHandler } from "~/lib/app.server";
import WebTrackingSection from "~/components/WebTrackingSection";
import DataSyncSection from "~/components/DataSyncSection";

/**
 * The loader function to fetch initial data for the page.
 * Delegates to `loaderHandler`.
 */
export const loader = loaderHandler;

/**
 * The action function to handle form submissions or interactions on the page.
 * Delegates to `actionHandler`.
 */
export const action = actionHandler;

/**
 * Main component for the index route.
 *
 * Fetches initial data and handles form submission results,
 * displaying appropriate UI sections and toast notifications.
 *
 * It renders:
 * - A welcome section with logo and description.
 * - Account connection section (with API key and account info).
 * - Connection status section (showing connection status script and app extension status).
 * - Enable/disable web tracking section.
 * - Enable/disable sync contacts section.
 * - Unsupported markets warning if applicable.
 * - Useful links section.
 *
 * Uses Shopify App Bridge for toast notifications.
 *
 * @returns {JSX.Element} The rendered page component.
 */
export default function Index() {
  const { t } = useTranslation();
  const shopify = useAppBridge();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const {
    shop,
    account,
    isMarketsOverflowing,
    scriptConnectionStatus,
    customersSyncLog,
    orderSyncLog,
    ENV,
  } = loaderData;
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
        open("shopify://admin/themes/current/editor?context=apps", "_top");
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
      <Box paddingBlockEnd="500">
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
                <Text as="p">
                  <Trans
                    i18nKey="WelcomeSection.description"
                    t={t}
                    components={{
                      supportLink: (
                        <Link
                          url={`${ENV.DOCK_URL}/docs/integrating-with-shopify`}
                          target="_blank"
                        />
                      ),
                    }}
                  />
                </Text>
              </BlockStack>
            </Layout.Section>
            <Layout.Section>
              <AccountConnectionSection
                apiKey={shop?.apiKey ?? ""}
                account={account}
                errors={actionData?.errors}
                disabled={isMarketsOverflowing || isSubmitting || isLoading}
              />
            </Layout.Section>
            <Layout.Section>
              <ConnectionStatusSection
                isApiKeyActive={!!account}
                isGeneralScriptExist={
                  scriptConnectionStatus?.isGeneralScriptExist
                }
                isWebPushScriptExist={
                  scriptConnectionStatus?.isWebPushScriptExist
                }
                isAppExtensionActive={
                  scriptConnectionStatus.isThemeExtensionActive
                }
                errors={actionData?.errors}
                dockUrl={ENV.DOCK_URL}
                platformUrl={ENV.PLATFORM_URL}
                disabled={
                  isMarketsOverflowing ||
                  isSubmitting ||
                  isLoading ||
                  !shop?.apiKey
                }
              />
            </Layout.Section>
            <Layout.Section>
              <WebTrackingSection
                isGeneralScriptExist={
                  scriptConnectionStatus?.isGeneralScriptExist
                }
                isWebPushScriptExist={
                  scriptConnectionStatus?.isWebPushScriptExist
                }
                isAppExtensionActive={
                  scriptConnectionStatus.isThemeExtensionActive
                }
                webTrackerEnabled={shop?.isWebTrackingEnabled ?? false}
                disabled={
                  isMarketsOverflowing || isSubmitting || isLoading || !account
                }
              />
            </Layout.Section>
            <Layout.Section>
              <DataSyncSection
                contactSyncEnabled={Boolean(shop?.isContactSyncEnabled)}
                orderSyncEnabled={Boolean(shop?.isOrderSyncEnabled)}
                disabled={
                  isMarketsOverflowing || isSubmitting || isLoading || !account
                }
                customersSyncLog={customersSyncLog as any}
                orderSyncLog={orderSyncLog as any}
              />
            </Layout.Section>
            <Layout.Section>
              <UsefulLinksSection />
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Box>
    </Page>
  );
}
