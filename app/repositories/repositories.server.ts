import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";
import GdprCustomerDataRepositoryImpl from "~/repositories/gdprCustomerData/gdprCustomerDataRepositoryImpl.server";
import EventDataRepositoryImpl from "~/repositories/eventData/eventDataRepositoryImpl.server";
import CustomerRepositoryImpl from "~/repositories/customer/customerRepositoryImpl.server";
import CustomerSyncRepositoryImpl from "~/repositories/customerSync/customerSyncRepositoryImpl.server";
import CustomerSyncLogRepositoryImpl from "~/repositories/customerSyncLog/customerSyncLogRepositoryImpl.server";
import OrderSyncRepositoryImpl from "~/repositories/orderSync/orderSyncRepositoryImpl.server";
import OrderSyncLogRepositoryImpl from "~/repositories/orderSyncLog/orderSyncLogRepositoryImpl.server";

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
const gdprCustomerDataRepository = new GdprCustomerDataRepositoryImpl(database);

/**
 * An instance of the EventDataRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create, and bulk delete event-related data.
 *
 * @type {EventDataRepositoryImpl}
 */
const eventDataRepository = new EventDataRepositoryImpl(database);

/**
 * An instance of the CustomerRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to upsert customer records in the data store.
 *
 * @type {CustomerRepositoryImpl}
 */
const customerRepository = new CustomerRepositoryImpl(database);

/**
 * An instance of the CustomerSyncRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create, update, and upsert customer sync records in the data store.
 *
 * @type {CustomerSyncRepositoryImpl}
 */
const customerSyncRepository = new CustomerSyncRepositoryImpl(database);

/**
 * An instance of the CustomerSyncLogRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create and update customer sync log record in the data store.
 *
 * @type {CustomerSyncLogRepositoryImpl}
 */
const customerSyncLogRepository = new CustomerSyncLogRepositoryImpl(database);

/**
 * An instance of the OrderSyncRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create, update, and upsert order sync records in the data store.
 *
 * @type {OrderSyncRepositoryImpl}
 */
const orderSyncRepository = new OrderSyncRepositoryImpl(database);

/**
 * An instance of the OrderSyncLogRepository implementation, initialized with the Prisma database client.
 *
 * Provides methods to retrieve, create and update order sync log record in the data store.
 *
 * @type {OrderSyncLogRepositoryImpl}
 */
const orderSyncLogRepository = new OrderSyncLogRepositoryImpl(database);

export {
  shopRepository,
  gdprCustomerDataRepository,
  eventDataRepository,
  customerRepository,
  customerSyncRepository,
  customerSyncLogRepository,
  orderSyncRepository,
  orderSyncLogRepository,
};
