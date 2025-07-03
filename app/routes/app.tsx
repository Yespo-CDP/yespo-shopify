import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useTranslation } from "react-i18next";

import { authenticate } from "../shopify.server";

/**
 * Links function to load stylesheets for the app.
 *
 * @returns {Array<{ rel: string; href: string }>} Array of link objects for stylesheets.
 */
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/**
 * Loader function that authenticates the admin user and
 * returns the Shopify API key from environment variables.
 *
 * @param {LoaderFunctionArgs} args - The loader function arguments containing the request.
 * @returns {Promise<{ apiKey: string }>} An object containing the Shopify API key.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

/**
 * Main app component wrapping the app in Shopify Polaris' AppProvider.
 *
 * Syncs the localization with Shopify App Bridge locale.
 *
 * @returns {JSX.Element} The app wrapper component.
 */
export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const { i18n } = useTranslation();
  const appBridge = useAppBridge();

  useEffect(() => {
    if (appBridge?.config?.locale) {
      i18n.changeLanguage(appBridge.config.locale);
    }
  }, [i18n, appBridge]);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

/**
 * Error boundary component for catching thrown responses,
 * rendering the app-specific error boundary UI.
 *
 * @returns {JSX.Element} Error boundary UI.
 */
// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

/**
 * Headers function to set HTTP headers for responses,
 * delegating to the app-specific boundary handler.
 *
 * @param {HeadersFunctionArgs} args - The arguments containing the request and context.
 * @returns {HeadersInit} The headers to include in the response.
 */
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
