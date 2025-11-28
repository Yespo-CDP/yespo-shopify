import type {LoaderFunctionArgs, ActionFunctionArgs} from "react-router";
import {authenticate} from "~/shopify.server";
import {getCollectionsService} from "~/services/get-collections.server";
import {getProductTypesOptionsService} from "~/services/get-product-types.server";
import updateCollectionMetafield from "~/shopify/mutations/update-collection-metafield.server";

interface CollectionMappingData {
  type: 'product_type' | 'category';
  value: string;
}

export const categoryPageLoaderHandler = async({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const limitParam = searchParams.get("limit");
  const after = searchParams.get("after");
  const before = searchParams.get("before");
  const search = searchParams.get("search");

  const limit = limitParam ? Number(limitParam) : undefined;

  // Fetch collections with pagination
  const collectionsResult = await getCollectionsService({
    admin,
    limit,
    after,
    before,
    query: search || undefined,
  });

  // Fetch all product types and categories in parallel
  const productTypes = await getProductTypesOptionsService({ admin })

  return {
    collections: collectionsResult.collections,
    pageInfo: collectionsResult.pageInfo,
    limit: limit ?? 10,
    productTypes
  };
}

export const categoryPageActionHandler = async({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent");

    switch (intent) {
      case "save": {
        const collectionId = formData.get("collectionId") as string;
        const entityType = formData.get("entityType") as string;
        const entityName = formData.get("entityName") as string;

        if (!collectionId || !entityType || !entityName) {
          return Response.json({
            success: false,
            error: "Missing required fields"
          }, {status: 400});
        }

        const mappingData: CollectionMappingData = {
          type: entityType === 'type' ? 'product_type' : 'category',
          value: entityName,
        };

        const result = await updateCollectionMetafield({
          admin,
          collectionId,
          key: process.env.CATEGORY_TYPE_HANDLE || "yespo_category_type",
          value: JSON.stringify(mappingData),
          type: "json"
        });

        if (!result.success) {
          return Response.json({
            success: false,
            error: result.error || "Failed to save mapping"
          }, {status: 500});
        }

        return Response.json({
          success: true,
          message: `${entityType === 'type' ? 'Product type' : 'Category'} saved successfully`
        });
      }

      case "delete": {
        const collectionId = formData.get("collectionId") as string;

        if (!collectionId) {
          return Response.json({
            success: false,
            error: "Missing collectionId"
          }, {status: 400});
        }

        const metafieldKey = process.env.CATEGORY_TYPE_HANDLE || 'yespo_category_type';

        // Delete metafield using ownerId, namespace, and key
        const deleteResponse = await admin.graphql(
          `
          #graphql
          mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) {
              deletedMetafields {
                key
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
              metafields: [{
                ownerId: collectionId,
                namespace: "$app",
                key: metafieldKey
              }],
            },
          }
        );

        const deleteData = await deleteResponse.json();
        const result = deleteData?.data?.metafieldsDelete;

        if (result?.userErrors && result.userErrors.length > 0) {
          const error = result.userErrors[0].message;
          console.error('[categoryPageActionHandler] Error:', error);
          return Response.json({
            success: false,
            error
          }, {status: 500});
        }

        return Response.json({
          success: true,
          message: 'Mapping removed successfully'
        });
      }

      default:
        return Response.json({
          success: false,
          error: "Invalid intent"
        }, {status: 400});
    }

  } catch (error) {
    console.error('[categoryPageActionHandler] Error:', error);
    return Response.json({
      success: false,
      error: String(error)
    }, {status: 500});
  }
}

