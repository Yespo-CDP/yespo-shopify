import {deleteContact} from "~/api/delete-contact";

/**
 * Deletes a contact by its external customer ID.
 *
 * Calls the `deleteContact` service with the given API key, customer ID,
 * and a flag indicating whether to erase data permanently.
 *
 * @param {string} externalCustomerId - The external ID of the customer to delete.
 * @param {string} apiKey - The API key used for authentication with the contact service.
 * @param {boolean} erase - If true, permanently erases the contact data.
 * @returns {Promise<void>} A promise that resolves when the contact deletion is complete.
 */
export const deleteContactService = async (externalCustomerId: string, apiKey: string, erase: boolean) => {
  await deleteContact({
    apiKey,
    externalCustomerId,
    erase
  })
}
