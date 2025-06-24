import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import CustomerDataRepositoryImpl from "~/repositories/customerData/customerDataRepositoryImpl.server";
import EventDataRepositoryImpl from "~/repositories/eventData/eventDataRepositoryImpl.server";

const shopRepository = new ShopRepositoryImpl(database);
const customerDataRepository = new CustomerDataRepositoryImpl(database)
const eventDataRepository = new EventDataRepositoryImpl(database)

export { shopRepository, customerDataRepository, eventDataRepository };
