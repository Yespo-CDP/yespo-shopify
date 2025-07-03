import type { FC } from "react";
import {
  Card,
  Text,
  BlockStack,
  List,
  Link,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";

/**
 * UsefulLinksSection component renders a card containing a list of helpful links.
 *
 * It fetches localized link data using the `useTranslation` hook and displays
 * each link with a label, URL, and description.
 *
 * The links are displayed as a bulleted list with each item containing a clickable
 * link and accompanying description.
 *
 * @component
 * @returns {JSX.Element} The rendered Useful Links section UI.
 *
 * @example
 * <UsefulLinksSection />
 */
const UsefulLinksSection: FC = () => {
  const { t } = useTranslation();
  const links = t("UsefulLinksSection.links", { returnObjects: true }) as {
    description: string;
    label: string;
    url: string;
  }[];

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {t("UsefulLinksSection.title")}
        </Text>
        <Text as="p" variant="bodyMd">
          {t("UsefulLinksSection.helpText")}
        </Text>
        <List type="bullet" gap="extraTight">
          {links.map((link, index) => (
            <List.Item key={`${link.url}-${index}`}>
              <Box paddingBlockEnd="200">
                <InlineStack gap="100" wrap={false}>
                  <div style={{ textWrap: "nowrap" }}>
                    <Link url={link.url} target="_blank">
                      {link.label}
                    </Link>
                  </div>
                  {"—"}
                  <Text as="p">{link.description}</Text>
                </InlineStack>
              </Box>
            </List.Item>
          ))}
        </List>
      </BlockStack>
    </Card>
  );
};

export default UsefulLinksSection;
