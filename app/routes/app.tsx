
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {  Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";


import { authenticate } from "../shopify.server";


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
  // const { i18n } = useTranslation();
  // const appBridge = useAppBridge();

  // useEffect(() => {
  //   if (appBridge?.config?.locale) {
  //     i18n.changeLanguage(appBridge.config.locale);
  //   }
  // }, [i18n, appBridge]);

  return (
    <AppProvider embedded apiKey={apiKey}>
        {/*<NavMenu>*/}
        {/*  <Link to="/app" rel="home">*/}
        {/*    Home*/}
        {/*  </Link>*/}
        {/*</NavMenu>*/}
        {/*<Outlet />*/}

      <s-app-nav>
        <s-link href="/app" >Home</s-link>
        {/*<s-link href="/app/additional">Additional page</s-link>*/}
      </s-app-nav>
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
// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
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
