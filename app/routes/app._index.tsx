import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

import UnsupportedMarketsSection from "~/components/UnsupportedMarketsSection";
import getMarkets from "~/services/markets.server";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const markets = await getMarkets({ admin, count: 200 });
  const activeMarkets = markets.filter((market) => market.enabled);
  return { isMarketsOverflowing: activeMarkets?.length > 1 };
};

export default function Index() {
  const { t } = useTranslation();
  const { isMarketsOverflowing } = useLoaderData<typeof loader>();

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
            <Card>Account connection section</Card>
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
