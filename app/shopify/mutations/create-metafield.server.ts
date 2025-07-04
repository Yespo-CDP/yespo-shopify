import type { Metafield } from "~/@types/metafield";

async function createMetafield({
  admin,
  shopId,
  key,
  value,
  type = "single_line_text_field"
}: {
  admin: any;
  shopId: string;
  key: string;
  value: string;
  type?: string
}): Promise<Metafield | null> {
  try {
    const response = await admin.graphql(
      `
      #graphql
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
            ownerType
            namespace
            type
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
              key,
              namespace: "$app",
              type: type,
              value: value.replace(/\n/g, "").replace(/\s+/g, " ").trim(),
              ownerId: shopId,
            },
          ],
        },
      },
    );

    const responseParse = await response.json();
    const metafieldData = responseParse?.data as {
      metafieldsSet: { metafields: Metafield[] };
    };
    const metafield = metafieldData?.metafieldsSet?.metafields[0];

    return metafield ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export default createMetafield;
