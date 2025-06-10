import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import CustomerDataRepositoryImpl from "~/repositories/customerData/customerDataRepositoryImpl.server";
import database from "~/db.server";

const shopRepository = new ShopRepositoryImpl(database);
const customerDataRepository = new CustomerDataRepositoryImpl(database)

export { shopRepository, customerDataRepository };
