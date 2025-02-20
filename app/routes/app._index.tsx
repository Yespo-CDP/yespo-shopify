import type { LoaderFunctionArgs } from "@remix-run/node";
import { Page, Layout, Card, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Remix app template"></TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>Hello world</Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
