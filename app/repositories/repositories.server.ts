import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import GdprCustomerDataRepositoryImpl from "~/repositories/gdprCustomerData/gdprCustomerDataRepositoryImpl.server";
import EventDataRepositoryImpl from "~/repositories/eventData/eventDataRepositoryImpl.server";
import CustomerRepositoryImpl from "~/repositories/customer/customerRepositoryImpl.server";

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
 * An instance of the GdprCustomerDataRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to manage GDPR-related customer data requests.
 *
 * @type {GdprCustomerDataRepositoryImpl}
 */
const gdprCustomerDataRepository = new GdprCustomerDataRepositoryImpl(database)

/**
 * An instance of the EventDataRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create, and bulk delete event-related data.
 *
 * @type {EventDataRepositoryImpl}
 */
const eventDataRepository = new EventDataRepositoryImpl(database)

/**
 * An instance of the CustomerRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to upsert customer records in the data store.
 *
 * @type {CustomerRepositoryImpl}
 */
const customerRepository = new CustomerRepositoryImpl(database)


export {
  shopRepository,
  gdprCustomerDataRepository,
  eventDataRepository,
  customerRepository
};
