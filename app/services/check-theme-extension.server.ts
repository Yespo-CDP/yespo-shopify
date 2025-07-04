import commentJSON from "comment-json";

import getThemes from "~/shopify/queries/get-themes";

/**
 * Checks whether the published Shopify theme has the Yespo app's theme extension enabled.
 *
 * This function fetches the store's published theme, retrieves its `settings_data.json` configuration,
 * parses the theme blocks, and determines if a block with the key matching
 * the general script handle (default `"yespo-script"`) exists and is not disabled.
 *
 * @param {Object} params - Function parameters.
 * @param {any} params.admin - Shopify Admin API client instance used to perform GraphQL queries.
 *
 * @returns {Promise<boolean>} Returns `true` if the theme extension block exists and is enabled; otherwise `false`.
 *
 * @example
 * const isExtensionActive = await checkThemeExtensionService({ admin });
 */

const GENERAL_SCRIPT_HANDLE =
  process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script";

async function checkThemeExtensionService({
  admin,
}: {
  admin: any;
}): Promise<boolean> {
  try {
    const themes = await getThemes({ admin });
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
      type.includes(GENERAL_SCRIPT_HANDLE),
    );

    return antlaBlock ? !antlaBlock?.disabled : false;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export default checkThemeExtensionService;
