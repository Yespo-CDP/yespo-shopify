/**
 * Updates metafield for a collection
 * Saves category or product type mapping to collection metafields
 */
async function updateCollectionMetafield({
  admin,
  collectionId,
  key,
  value,
  type = "single_line_text_field"
}: {
  admin: any;
  collectionId: string;
  key: string;
  value: string;
  type?: string;
}): Promise<{success: boolean; error?: string}> {
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
              value: value,
              ownerId: collectionId,
            },
          ],
        },
      },
    );

    const responseParse = await response.json();
    const metafieldData = responseParse?.data?.metafieldsSet;

    // Check for errors
    if (metafieldData?.userErrors && metafieldData.userErrors.length > 0) {
      const error = metafieldData.userErrors[0].message;
      console.error('[updateCollectionMetafield] Error:', error);
      return {success: false, error};
    }

    return {success: true};
  } catch (error) {
    console.error('[updateCollectionMetafield] Exception:', error);
    return {success: false, error: String(error)};
  }
}

export default updateCollectionMetafield;

