import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Layout, Card, BlockStack, Text } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

import UnsupportedMarketsSection from "~/components/UnsupportedMarketsSection";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const { t } = useTranslation();

  return (
    <Page>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <UnsupportedMarketsSection />
          </Layout.Section>
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
