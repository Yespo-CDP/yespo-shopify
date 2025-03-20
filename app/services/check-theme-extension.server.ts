import commentJSON from "comment-json";

import getThemes from "~/shopify/queries/get-themes";

async function checkThemeExtensionService({
  admin,
}: {
  admin: any;
}): Promise<boolean> {
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
    type.includes(process.env.GENERAL_SCRIPT_HANDLE ?? "yespo-script"),
  );

  return antlaBlock ? !antlaBlock?.disabled : false;
}

export default checkThemeExtensionService;
