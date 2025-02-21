import en from "~/locales/en.json";
import pl from "~/locales/pl.json";
import pt from "~/locales/pt.json";

export const supportedLngsOptions = [
  { label: "English", value: "en" },
  { label: "Polish", value: "pl" },
  { label: "Portuguese", value: "pt" },
];

// This is the list of languages your application supports
export const supportedLngs = supportedLngsOptions.map(({ value }) => value);

// This is the language you want to use in case
// if the user language is not in the supportedLngs
export const fallbackLng = "en";

// The default namespace of i18next is "translation", but you can customize it
// here
export const defaultNS = "translation";

export const resources = {
  en: { translation: en },
  pl: { translation: pl },
  pt: { translation: pt },
};
