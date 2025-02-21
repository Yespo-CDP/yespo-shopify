import { RemixBrowser } from "@remix-run/react";
import i18next from "i18next";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { getInitialNamespaces } from "remix-i18next/client";

import * as i18n from "~/i18n";

async function main() {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18next
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .init({
      ...i18n,
      ns: getInitialNamespaces(),
    });

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <RemixBrowser />
        </StrictMode>
      </I18nextProvider>,
    );
  });
}

main().catch((error) => console.error(error));
