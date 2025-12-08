import type { ThemesResponse } from "~/@types/theme";
import {sendLogEvent} from "~/api/send-log-event";
import {EVENT_MESSAGES} from "~/config/constants";

/**
 * Retrieves the main theme from the Shopify store using the Admin GraphQL API.
 *
 * This function queries the store's main theme (`role: MAIN`) and attempts to fetch the
 * `config/settings_data.json` file content associated with it. It returns an array of themes,
 * where each theme includes basic details (ID, name, role) and optionally the file content.
 *
 * If the request fails or no themes are found, it returns an empty array.
 *
 * @param {Object} params - The input parameters.
 * @param {any} params.admin - The authenticated Shopify Admin API client instance.
 *
 * @returns {Promise<Theme[]>} A promise that resolves to an array of `Theme` objects.
 *
 * @example
 * const themes = await getThemes({ admin });
 * if (themes.length > 0) {
 *   console.log("Main theme:", themes[0].name);
 * }
 */
async function getThemes({ admin, domain, orgId }: { admin: any, domain: string, orgId?: number | null; }) {
  try {
    const response = await admin.graphql(`
      #graphql
      query {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            id
            name
            role
            files(first: 1, filenames: "config/settings_data.json") {
              nodes {
                filename
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }
    `);
    const responseParse = await response.json();
    const themesData = responseParse?.data as ThemesResponse;
    const themes = themesData.themes?.nodes;

    return themes ?? [];
  } catch (error: any) {
    console.error(error);

    await sendLogEvent({
      orgId,
      errorMessage: `Theme not received: ${error.message}`,
      data: {
        domain,
        requestBody: {},
        responseBody: error,
        statusCode: error?.status ?? 500
      },
      message: EVENT_MESSAGES.CUSTOM_LOG_GET_STORE_THEME_ERROR,
      logLevel: 'ERROR'
    })
    return [];
  }
}

export default getThemes;
