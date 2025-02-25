import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";
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
import { shopRepository } from "~/repositories/repositories.server";
import getAccountInfo from "~/services/account.service";
import getMarkets from "~/services/markets.server";
import createDomain from "~/services/domain.service";
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
  const errors: { apiKey?: string; script?: string } = {};
  const success: { apiKey?: boolean; script?: boolean } = {};

  if (intent === "account-connection") {
    const apiKey = formData.get("apiKey")?.toString();
    if (!apiKey) {
      errors.apiKey = t("AccountConnectionSection.errors.emptyApiKey");
      return { success, errors };
    }

    try {
      await getAccountInfo({ apiKey });
      await shopRepository.updateShop(session.shop, { apiKey });
      success.apiKey = true;
    } catch (error: any) {
      errors.apiKey = t(`AccountConnectionSection.errors.${error.message}`);
      return { success, errors };
    }
  }

  if (intent === "connection-status") {
    const status = formData.get("connectionStatus")?.toString();
    if (status !== "true" && status !== "false") {
      errors.script = t("ConnectionStatusSection.errors.emptyConnectionStatus");
      return { success, errors };
    }

    try {
      const shop = await shopRepository.getShop(session.shop);
      if (!shop || !shop?.apiKey) {
        errors.script = t("AccountConnectionSection.errors.emptyApiKey");
        return { success, errors };
      }

      if (status === "true") {
        await createDomain({
          apiKey: shop.apiKey,
          domain: shop.domain,
        });
      }

      await shopRepository.updateShop(session.shop, {
        isScriptActive: status === "true",
      });

      success.script = true;
    } catch (error: any) {
      errors.script = t(`ConnectionStatusSection.errors.${error.message}`);
      return { success, errors };
    }
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
    } else if (actionData?.success?.script) {
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
              disabled={isMarketsOverflowing || isSubmitting}
            />
          </Layout.Section>
          <Layout.Section>
            <ConnectionStatusSection
              isScriptActive={!!shop?.isScriptActive}
              errors={actionData?.errors}
              disabled={isMarketsOverflowing || isSubmitting || !shop?.apiKey}
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
