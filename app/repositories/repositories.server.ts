import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import EventDataRepositoryImpl from "~/repositories/eventData/eventDataRepositoryImpl.server";
import GdprCustomerDataRepositoryImpl from "~/repositories/gdprCustomerData/gdprCustomerDataRepositoryImpl.server";
import CustomerRepositoryImpl from "~/repositories/customer/customerRepositoryImpl.server";

const shopRepository = new ShopRepositoryImpl(database);
const gdprCustomerDataRepository = new GdprCustomerDataRepositoryImpl(database)
const eventDataRepository = new EventDataRepositoryImpl(database)
const customerRepository = new CustomerRepositoryImpl(database)

export {
  shopRepository,
  gdprCustomerDataRepository,
  eventDataRepository,
  customerRepository
};
