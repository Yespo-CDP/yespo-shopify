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

const UsefulLinksSection: FC = () => {
  const { t } = useTranslation();

  const links = [
    {
      title: "Yespo documentation",
      url: "https://yespo.io/support/integration-with-api",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc efficitur orci vel lacus p",
    },
    {
      title: "Yespo documentation",
      url: "https://yespo.io/support/integration-with-api",
      description:
        "n feugiat sit amet, blandit sit amet nunc. Sed molestie id ex vitae viverra. Nulla cu",
    },
    {
      title: "Yespo documentation",
      url: "https://yespo.io/support/integration-with-api",
      description:
        " dolor sit amet, consectetur adipiscing elit. Nunc efficitur orci vel lacus pharetra, vitae gravida arcu facilisis. Maecenas ipsum dui, efficitur in pharetra ac, luctus id urna. In dia",
    },
    {
      title: "Yespo documentation",
      url: "https://yespo.io/support/integration-with-api",
      description:
        "ollicitudin feugiat sit amet, blandit sit amet nunc. Sed molestie id ex vitae viverra. Nulla cursus viverra ipsum eu luctus. Duis non elit ornare, vestibulum sem nec, commodo lectus",
    },
    {
      title: "Yespo documentation",
      url: "https://yespo.io/support/integration-with-api",
      description:
        "sit amet, consectetur adipiscing elit. Nunc efficitur orci vel lacus pharetra, vitae gravida arcu facilisis. Maecenas ipsum dui, efficitur in pharetra ac, luctus id urna. In diam purus",
    },
  ];

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {t("UsefulLinksSection.title")}
        </Text>
        <Text as="p" variant="bodyMd">
          {t("UsefulLinksSection.helpText")}
        </Text>
        <List type="bullet">
          {links.map((link, index) => (
            <List.Item key={`${link.url}-${index}`}>
              <Box paddingBlockEnd="200">
                <InlineStack gap="100" wrap={false}>
                  <div style={{ textWrap: "nowrap" }}>
                    <Link url={link.url} target="_blank">
                      {link.title}
                    </Link>
                  </div>
                  {"ꟷ"}
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
