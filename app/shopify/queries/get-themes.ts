import type { ThemesResponse } from "~/@types/theme";

async function getThemes({ admin }: { admin: any }) {
  try {
    const response = await admin.graphql(`
      #graphql
      query {
        themes(first: 200) {
          nodes {
            id
            name
            role
            files(first: 200, filenames: "config/settings_data.json") {
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
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default getThemes;
