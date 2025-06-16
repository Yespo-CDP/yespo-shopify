import {deleteContact} from "~/api/delete-contact";

export const deleteContactService = async (externalCustomerId: string, apiKey: string, erase: boolean) => {
  await deleteContact({
    apiKey,
    externalCustomerId,
    erase
  })
}
