import {deleteContact} from "~/api/delete-contact";

export const deleteContactService = async (externalCustomerId: string, apiKey: string) => {
  await deleteContact({
    apiKey,
    externalCustomerId,
    erase: true
  })
}
