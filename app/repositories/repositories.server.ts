import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import CustomerDataRepositoryImpl from "~/repositories/customerData/customerDataRepositoryImpl.server";

/**
 * An instance of the ShopRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to interact with the Shop data model, including retrieving, creating,
 * updating, and deleting shop records.
 *
 * @type {ShopRepositoryImpl}
 */
const shopRepository = new ShopRepositoryImpl(database);

/**
 * An instance of the CustomerDataRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to manage GDPR-related customer data requests.
 *
 * @type {CustomerDataRepositoryImpl}
 */
const customerDataRepository = new CustomerDataRepositoryImpl(database)

export { shopRepository, customerDataRepository };
