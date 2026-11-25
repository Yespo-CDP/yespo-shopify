import { shopRepository } from "~/repositories/repositories.server";
import { createShopKey } from "~/services/event-data-signature.server";

/**
 * Creates the shop's key for signing event data and saves it in the app-data
 * metafield `yespo.yespo-event-key` (read in Liquid as `app.metafields`), then
 * in `Shop.publicApiKey`. The database is not changed if the metafield write
 * fails. Safe to repeat.
 *
 * The key is a secret: it has no metafield definition, and it is never logged,
 * returned or kept in an error.
 *
 * @throws {Error} If the key cannot be created or saved.
 */
export async function ensureShopPublicApiKey({
  admin,
  shopUrl,
  shopGid,
}: {
  admin: {
    graphql: (
      query: string,
      options?: { variables: Record<string, unknown> },
    ) => Promise<Response>;
  };
  shopUrl: string;
  shopGid: string;
}): Promise<void> {
  const publicApiKey = createShopKey(shopGid);

  try {
    const installationResponse = await admin.graphql(
      `
      #graphql
      query {
        currentAppInstallation {
          id
        }
      }
    `,
    );
    const ownerId = (await installationResponse.json())?.data
      ?.currentAppInstallation?.id;
    if (!ownerId) {
      throw new Error("App installation not found");
    }

    const response = await admin.graphql(
      `
      #graphql
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
      {
        variables: {
          metafields: [
            {
              ownerId,
              namespace: "yespo",
              key: "yespo-event-key",
              type: "single_line_text_field",
              value: publicApiKey,
            },
          ],
        },
      },
    );
    const result = (await response.json())?.data?.metafieldsSet;
    if (result?.userErrors?.length || !result?.metafields?.[0]?.id) {
      throw new Error(
        result?.userErrors?.[0]?.message ?? "The metafield was not saved",
      );
    }

    await shopRepository.updateShop(shopUrl, { publicApiKey });
  } catch (error: unknown) {
    // Shopify and Prisma errors may repeat the rejected input, so only the
    // message is kept, without the key. The admin client can throw a Response.
    const message =
      error instanceof Response
        ? `HTTP ${error.status}`
        : String((error as Error)?.message);
    throw new Error(
      `Event key was not saved for ${shopUrl}: ${message.replaceAll(publicApiKey, "***")}`,
    );
  }
}
