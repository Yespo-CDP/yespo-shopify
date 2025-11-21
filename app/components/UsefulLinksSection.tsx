import type { FC } from "react";
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
    <s-section>
      <s-stack gap="small-200">
        <h2 style={{margin: 0, fontSize: '0.875rem', fontWeight: 650}}>
          {t("UsefulLinksSection.title")}
        </h2>
        <s-paragraph>
          {t("UsefulLinksSection.helpText")}
        </s-paragraph>

        <s-unordered-list>
          {links.map((link, index) => (
            <s-list-item key={`${link.url}-${index}`}>
              <s-box paddingBlockEnd="small-200">
                <s-stack direction="inline" gap="small-100">
                  <div style={{ textWrap: "nowrap" }}>
                    <s-link href={link.url} target="_blank">{link.label}</s-link>
                  </div>
                  {"—"}
                  <s-paragraph>
                    {link.description}
                  </s-paragraph>
                </s-stack>
              </s-box>
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-stack>
    </s-section>
  );
};

export default UsefulLinksSection;
