/**
 * Temporary stub for the Yespo DELETE /v1/products API.
 *
 * Replace with a real HTTP call once the payload builders are updated.
 * Each item requires productId and updatedDate (RFC3339 UTC).
 *
 * @param {Object} params - The input parameters.
 * @param {string} params.apiKey - The API key used for authentication.
 * @param {string} params.siteId - The Yespo site/account identifier.
 * @param {string[]} params.externalVariantIds - Variant IDs to delete.
 * @param {string} params.domain - The shop domain for logging.
 * @param {number | null | undefined} params.orgId - The Yespo organization id for logging.
 */
export const deleteProductVariants = async ({
  apiKey,
  siteId,
  externalVariantIds,
  domain,
  orgId,
}: {
  apiKey: string;
  siteId: string;
  externalVariantIds: string[];
  domain: string;
  orgId?: number | null;
}): Promise<void> => {
  // FIXME: Replace with a real HTTP call once the delete payload builder provides updatedDate per variant:
  // const url = `${process.env.API_URL}/v1/products`;
  // const authHeader = getAuthHeader(apiKey);
  // await fetchWithErrorHandling(url, {
  //   method: "DELETE",
  //   headers: { "content-type": "application/json", Authorization: authHeader },
  //   body: JSON.stringify({
  //     siteId,
  //     products: externalVariantIds.map((productId) => ({
  //       productId,
  //       updatedDate: new Date().toISOString(), // TODO: use actual source timestamp
  //     })),
  //   }),
  // });
  void apiKey;
  void siteId;
  void externalVariantIds;
  void domain;
  void orgId;
};
