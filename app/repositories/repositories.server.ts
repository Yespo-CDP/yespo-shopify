import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import CustomerDataRepositoryImpl from "~/repositories/customerData/customerDataRepositoryImpl.server";

const shopRepository = new ShopRepositoryImpl(database);
const customerDataRepository = new CustomerDataRepositoryImpl(database)

export { shopRepository, customerDataRepository };
