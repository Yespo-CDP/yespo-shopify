import commentJSON from "comment-json";

import type { ThemesResponse } from "~/@types/theme";

async function checkThemeExtension({ admin }: { admin: any }) {
  const response = await admin.graphql(
    `#graphql
    query {
      themes(first: 10) {
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
    }`,
  );
  const responseParse = (await response.json()) as ThemesResponse;

  const themes = responseParse.data.themes?.nodes;
  const publishedTheme = themes?.find((theme) => theme.role === "MAIN");

  if (!publishedTheme) {
    return false;
  }

  const config = publishedTheme.files.nodes.find(
    (file) => file.filename === "config/settings_data.json",
  );

  if (!config) {
    return false;
  }

  const configParse = commentJSON.parse(config.body.content) as unknown as {
    current?: { blocks: { type: string; disabled: boolean }[] };
  };
  const appBlocks = configParse?.current?.blocks
    ? Object.values(configParse?.current.blocks)
    : [];
  const antlaBlock = appBlocks.find(({ type }) =>
    type.includes(process.env.SCRIPT_HANDLE ?? "yespo-script"),
  );
  
  return antlaBlock ? !antlaBlock?.disabled : false;
}

export default checkThemeExtension;
