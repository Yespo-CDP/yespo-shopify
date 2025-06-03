import {createContact} from "~/api/create-contact";

export const createContactService = async (payload: any, apiKey: string) => {
  const channels = []

  if (payload.email) {
    channels.push({
      type: 'email',
      value: payload.email,
    })
  }

  if (payload.phone) {
    channels.push({
      type: 'sms',
      value: payload.phone,
    })
  }

  const contactData = {
    firstName: payload.first_name || '',
    lastName: payload.last_name || '',
    channels,
    externalCustomerId: payload.id.toString(),
  }

  await createContact({
    apiKey,
    contactData
  })
}
