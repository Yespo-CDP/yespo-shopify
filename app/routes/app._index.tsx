import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

import UnsupportedMarketsSection from "~/components/UnsupportedMarketsSection";
import AccountConnectionSection from "~/components/AccountConnectionSection";
import { shopRepository } from "~/repositories/repositories.server";
import getMarkets from "~/services/markets.server";
import { authenticate } from "~/shopify.server";
import i18n from "~/i18n.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const markets = await getMarkets({ admin, count: 200 });
  const shop = await shopRepository.getShop(session.shop);
  const activeMarkets = markets.filter((market) => market.enabled);
  return { shop, isMarketsOverflowing: activeMarkets?.length > 1 };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const t = await i18n.getFixedT(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const errors: { apiKey?: string } = {};
  const success: { apiKey?: boolean } = {};

  if (intent === "account-connection") {
    const apiKey = formData.get("apiKey")?.toString();
    if (!apiKey) {
      errors.apiKey = t("AccountConnectionSection.errors.emptyApiKey");
    }

    if (Object.keys(errors).length > 0) {
      return { success, errors };
    }

    await shopRepository.updateShop(session.shop, { apiKey });
    success.apiKey = true;
  }

  return { success, errors };
};

export default function Index() {
  const { t } = useTranslation();
  const shopify = useAppBridge();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { shop, isMarketsOverflowing } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success?.apiKey) {
      shopify.toast.show(t("AccountConnectionSection.success"), {
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
              <Text as="h1" variant="heading3xl" fontWeight="medium">
                {t("WelcomeSection.title")}
              </Text>
              <Text as="p">{t("WelcomeSection.description")}</Text>
            </BlockStack>
          </Layout.Section>
          <Layout.Section>
            <AccountConnectionSection
              apiKey={shop?.apiKey ?? ""}
              errors={actionData?.errors}
              disabled={isMarketsOverflowing || isSubmitting}
            />
          </Layout.Section>
          <Layout.Section>
            <Card>Script connection status section</Card>
          </Layout.Section>
          <Layout.Section>
            <Card>Useful links section</Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
