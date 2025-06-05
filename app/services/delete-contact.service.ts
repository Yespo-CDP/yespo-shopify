import {deleteContact} from "~/api/delete-contact";

export const deleteContactService = async (externalCustomerId: string, apiKey: string, erase: boolean) => {
  try {
    await deleteContact({
      apiKey,
      externalCustomerId,
      erase
    })
  } catch (error) {
    console.error(error);
  }
}
