import en from "~/locales/en.json";
import pl from "~/locales/pl.json";
import pt from "~/locales/pt.json";
import es from "~/locales/es.json";
import it from "~/locales/it.json";
import de from "~/locales/de.json";
import fr from "~/locales/fr.json";

export const supportedLngsOptions = [
  { label: "English", value: "en" },
  { label: "Polish", value: "pl" },
  { label: "Portuguese", value: "pt" },
  { label: "Spanish", value: "es" },
  { label: "Italian", value: "it" },
  { label: "German", value: "de" },
  { label: "French", value: "fr" },
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
  es: { translation: es },
  it: { translation: it },
  de: { translation: de },
  fr: { translation: fr },
};
