import {updateContact} from "~/api/update-contact";

export const updateContactService = async (payload: any, apiKey: string) => {
  const channels = []
  let address = {}

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

  if (payload.default_address) {
    address = {
      town: payload.default_address.city || '',
      address: payload.default_address.address1 || '',
      postcode: payload.default_address.zip || '',
    }
  }

  const contactData = {
    firstName: payload.first_name,
    lastName: payload.last_name,
    channels,
    externalCustomerId: payload.id.toString(),
    address: address
  }

  await updateContact({
    apiKey,
    contactData
  })
}
