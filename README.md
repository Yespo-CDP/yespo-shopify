# Yespo Shopify App

Shopify app for integration Yespo with Shopify

### Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo
- Sync order data (create, update) from Shopify to Yespo
- Automatically register their store domain in Yespo (to get site and web push scripts)
- Inject site and push scripts into the storefront via Theme App Extensions
- Install the service worker file for web push notifications using a Shopify App Proxy
- Send tracking events like MainPage, 404 Page, ProductPage, CustomerData, StatusCart and PurchasedItems from your store to Yespo


## Features and Implementation Details

### Widgets

**Purpose:** Register the store domain and inject the Yespo site script into the storefront automatically.

Implementation:
- [Registers](https://docs.esputnik.com/reference/createdomain) the current store domain in Yespo
- [Retrieves](https://docs.esputnik.com/reference/getscript) the Yespo site script
- Stores the script content in a Shopify metafield: yespo-script
- Injects the script into the storefront using a Theme App Extension (./extensions/yespo-extension)

### Web Push Subscription

**Purpose:** Enable customer subscriptions to web push notifications by registering the domain and injecting required scripts.

#### Implementation

- [Registers](https://docs.esputnik.com/reference/addwebpushdomain) the current store domain in Yespo
- [Retrieves](https://docs.esputnik.com/reference/getscript) the push script and service worker content
- Stores the push script in the yespo-web-push-script metafield
- Injects the push script into the storefront using the same Theme App Extension

#### Enabling web tracking

- Open the Yespo app
- Connect your Yespo account
- Enable tracking in the **Web Tracking** section

#### Service Worker Installation

- A Shopify App Proxy is used to serve the service worker content dynamically from Yespo
- The worker file is exposed at a predefined path (/apps/yespo/sw.js) to comply with browser requirements

### Contact Sync (Shopify → Yespo)

**Purpose:** Automatically sync new, updated, and deleted customers from Shopify to Yespo as contacts.
The process covers both **historical synchronization** and **real-time synchronization** through Shopify webhooks.

---

#### Implementation

- App requests access to the following scopes:
  - `read_customers`
  - `write_customers`
- Shopify webhooks used:
  - `customers/create` → creates a new contact in Yespo
  - `customers/update` → updates existing contact data
  - `customers/redact` → removes contact in Yespo

---

#### Enabling contact sync

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section

When sync is enabled:

- A new synchronization job is added to the **Redis queue**
- A dedicated **worker** processes the job and starts **historical synchronization**
- Runs once after being enabled (or re-enabled)
- Triggered before orders synchronization

---

#### Historical customers sync

1. **Counting customers**

   * First, a request is made to Shopify using [customersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/customerscount) to get the total number of customers.
   * This value is stored as `totalCount` for logging and statistics.

2. **Fetching customers in batches**

   * Customers are fetched in **chunks of 200** using the [customers query](https://shopify.dev/docs/api/admin-graphql/latest/queries/customers).
   * Each page is retrieved iteratively until all customers are processed.

3. **Validation by `updatedAt`**

   * For every customer, the `updatedAt` field from Shopify is compared against the local database:

     * If the value matches → the customer is **skipped** (no sync needed).
     * If the value differs or the customer does not exist locally → the customer is **added to the sync batch**.
     * We update the database to save the clients we synchronize
4. **Bulk sending to Yespo**

   * Filtered customers are grouped and sent to Yespo using [Contacts Bulk Update](https://docs.esputnik.com/reference/contactsbulkupdate-1).
   * Deduplication in Yespo is based on:

     * `externalCustomerId`
     * `email`
     * `phone`
   * If a customer exists in Yespo, it is **updated**, not duplicated.

5. **Repeat until completion**

   * The process continues page by page until all customers are checked and either skipped or sent.

---
 
#### Field Mapping [Shopify Customers](https://shopify.dev/docs/api/admin-graphql/latest/queries/customers) →  [Yespo Contacts](https://docs.esputnik.com/reference/contactsbulkupdate-1):
  - `customer.id` → `externalCustomerId`
  - `customer.firstName` → `firstName`
  - `customer.lastName` → `lastName`
  - `customer.defaultEmailAddress.emailAddress` → `channels[type=email].value`
  - `customer.defaultPhoneNumber.phoneNumber` → `channels[type=sms].value`
  - `customer.defaultAddress.phone` (if defaultPhoneNumber not exist) → `channels[type=sms].value`
  - `customer.defaultAddress.city` → `address.town`
  - `customer.defaultAddress.address1` → `address.address`
  - `customer.defaultAddress.zip` → `address.postcode`

---

#### Logging & Status Tracking

- `totalCount` – total number of customers from Shopify
- `skippedCount` – customers that were already up-to-date (not displayed in the UI)
- `syncedCount` – customers sent to Yespo
- `failedCount` – customers rejected by Yespo

Final synchronization status:
- `COMPLETE` → all customers processed successfully
- `ERROR` → if a network failure or any unknown error occurs during the synchronization process

---

#### Real-time customers sync

Webhooks are triggered immediately when events occur in Shopify:

  - `customers/create` → new contact sent to Yespo.
  - `customers/update` → existing contact updated in Yespo.
  - `customers/redact` → contact removed from Yespo.

---
#### Shopify API methods:

- [query /customersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/customerscount) – returns the count of customers for the given shop
- [query /customers](https://shopify.dev/docs/api/admin-graphql/latest/queries/customers) – returns a list of customers placed in the stores.


#### Yespo API methods:

- [POST /contact](https://docs.esputnik.com/reference/addcontact-1) – create or update contact
- [DELETE /contact](https://docs.esputnik.com/reference/deletecontact-1) (erase=true) – remove contact

### Order Sync (Shopify → Yespo)

**Purpose:** Automatically sync new and updated orders from Shopify to Yespo.
Supports both **historical synchronization** and **real-time synchronization**.

---

#### Implementation

App requests access to the following scopes:
  - `read_orders`
  - `read_all_orders`

Shopify webhooks used:
  - `orders/create` → creates a new order in Yespo
  - `orders/updated` → updates existing order data

---

#### Enabling order sync

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section

When sync is enabled:

- A new job is added to **Redis**
- A worker begins **historical orders synchronization**
- Runs once after being enabled (or re-enabled)
- Triggered after customer synchronization

---

#### Historical orders sync

1. **Counting orders**

   * Shopify [ordersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/orderscount) is called to get the total number of orders (`totalCount`).

2. **Fetching orders in batches**

   * Orders are fetched using the [orders query](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders).
   * Since each order includes `lineItems`, the batch size is **150** (instead of 200 for customers) to stay within Shopify’s API limits.

3. **Validation by `updatedAt`**

   * Each order’s `updatedAt` is compared with the local database:

     * If the order is unchanged → skipped
     * If new or updated → added to sync batch
     * We update the database to save the orders we synchronize

4. **Bulk sending to Yespo**

   * Orders are sent to Yespo using [Orders Bulk Insert](https://docs.esputnik.com/reference/ordersbulkinsert-1).

---
  
#### Field Mapping [Shopify Order](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) →  [Yespo Order](https://docs.esputnik.com/reference/ordersbulkinsert-1):
- `order.id` → `externalOrderId`
- `order.customer.id` → `externalCustomerId`
- `order.customer.firstName` → `firstName`
- `order.customer.lastName` → `lastName`
- `order.customer.defaultEmailAddress.emailAddress` → `email`
- `order.customer.defaultPhoneNumber.phoneNumber` → `phone`
- `order.totalPriceSet.shopMoney.amount` → `totalCost`
- `order.totalDiscountsSet.shopMoney.amount` → `discount`
- `order.totalShippingPriceSet.shopMoney.amount` → `shipping`
- `order.totalTaxSet.shopMoney.amount` → `taxes`
- `order.currencyCode` → `currency`
- `order.createdAt` (converted to UTC) → `date`
- `order.displayFulfillmentStatus` (+ cancelledAt check) → `status`
- `order.shippingAddress` (formatted string) → `deliveryAddress`
- `order.lineItems.nodes[]`:
  - `lineItem.id` → `externalItemId`
  - `lineItem.name` → `name`
  - `lineItem.quantity` → `quantity`
  - `lineItem.originalTotalSet.shopMoney.amount` → `cost`

---

#### Status Mapping

Order statuses from Shopify are mapped to Yespo statuses:

**Webhook `fulfillment_status` → Yespo status**

* `restocked`, `cancelledAt` → `CANCELLED`
* `partial` → `IN_PROGRESS`
* `fulfilled` → `DELIVERED`
* `null` → `INITIALIZED`

**`displayFulfillmentStatus` → Yespo status**

* `REQUEST_DECLINED`, `cancelledAt` → `CANCELLED`
* `PARTIALLY_FULFILLED`, `PENDING_FULFILLMENT`, `IN_PROGRESS` → `IN_PROGRESS`
* `FULFILLED` → `DELIVERED`
* `other` → `INITIALIZED`

---

#### Logging & Status Tracking

- `totalCount` – total number of orders from Shopify
- `skippedCount` – orders already up-to-date
- `syncedCount` – orders successfully sent to Yespo
- `failedCount` – orders rejected by Yespo

Final synchronization status:
- `COMPLETE` → sync finished successfully
- `ERROR` → failure occurred

---

#### Real-time orders sync

Webhooks are triggered when orders are created or updated in Shopify:

  - `orders/create` → new order sent to Yespo
  - `orders/updated` → existing order updated in Yespo

---

#### Shopify API methods:

- [query /ordersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/orderscount) – returns the count of orders for the given shop.
- [query /orders](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) – returns a list of orders placed in the stores.

#### Yespo API methods:

- [POST /orders](https://docs.esputnik.com/reference/ordersbulkinsert-1) – the method is used for create or update orders.

### Web Tracking
**Purpose:** Allows you to track events within your site.

Implementation:
- Stores the enable flag in the web-tracking-enabled metafield
- Send tracking events from the site to Yespo through Theme extension.

#### Frontend Events
- **MainPage** - [MainPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#main-page) occurs when user visited Home page of the site
- **404 Page** - [404 Page event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#404-page) occurs when user visited 404 page of the site
- **Status Cart Page** - [StatusCartPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#additional-events-required-for-recommendations-on-the-site) occurs when user visited /cart page of the site
- **Category Page** - [StatusCartPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#category) occurs when user visited products collection page of the site
- **ProductPage** - [ProductPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#product-card) occurs when user visited product page of the site and sends payload with product data:
  - productKey - product id
  - price - product price
  - isInStock - indicates if product is in stock
- **CustomerData** - [CustomerData event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#customer) occurs when there is a logged in user on the site and sends payload with customer data:
  - externalCustomerId - customer id
  - user_email - customer email
  - user_name - customer name
  - phone - customer phone

#### Backend Events
- **StatusCart** - [StatusCart event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#statuscart) 
occurs when CARTS_UPDATE webhook happened and sends payload with cart data.
- **PurchasedItems** - [PurchasedItems](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#purchaseditems)
occurs when ORDERS_CREATE webhook happened and sends payload with purchased products data.


## Technologies and Shopify Tools Used

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) – provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) – allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) – Theme app extensions allow the Yespo app to 
seamlessly inject scripts into a merchant’s theme without manual code edits.
  You can find the extension code in the `./extensions/yespo-extension` directory.
  This extension includes:
  - `blocks/` – Contains Liquid files that act as entry points for injecting Yespo scripts into the theme. These blocks can be enabled via the Shopify theme editor.
  - `assests/` – Contains JavaScript script that sends events using eS.JS.
- [Polaris](https://polaris.shopify.com/) – Design system that enables apps to create Shopify-like experiences
- [Webhooks](https://shopify.dev/docs/api/webhooks?reference=toml) – to receive notifications about particular events in a shop such as customer-related changes.
- [Metafields](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces) – 
used for storing tracking and scripts configurations (custom namespace: $app)

## Yespo API Authentication

The app uses a Yespo API key, provided by the merchant during onboarding, to authorize all API requests. The key is stored securely and used for:
- Contact sync
- Order sync
- Domain registration
- Script retrieval

Full API documentation: https://docs.yespo.io/docs/integration-with-api


## Quick start

### Prerequisites

Before you begin, you'll need the following:

1. **Node.js**: version 20 [Download and install](https://nodejs.org/en/download/) it if you haven't already.
2. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup) if you don't have one.
3. **Test Store**: Set up either a [development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or a [Shopify Plus sandbox store](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store) for testing your app.

### Setup

#### Environment variables

Create a `.env` file with the following:

| Name                           | Description                                                                                             | Example                                            |
|--------------------------------|---------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| **SHOPIFY_API_KEY**            | **Required.** Your shopify app Client ID                                                                | `12e4a9a4*****************eb80fba`                 |
| **SHOPIFY_API_SECRET**         | **Required.** Your shopify app Client secret                                                            | `f7725*********************420ad06`                |
| **SHOPIFY_APP_URL**            | **Required.** Your shopify app url                                                                      | `https://your-domain.com`                          |
| **SHOPIFY_YESPO_EXTENSION_ID** | **Required.** Extension ID (Auto generated after run `deploy` command)                                  | `c10***ff-****-48cc-****-f882b***fa8e`             |
| **DATABASE_URL**               | **Required.** Database connect url                                                                      | `postgresql://admin:admin@localhost:5432/database` |
| **SCOPES**                     | **Required.** Required access scopes                                                                    | **Must be** `read_markets,read_themes`             |
| **API_URL**                    | **Required.** Yespo api url                                                                             | **Must be** `https://yespo.io/api/v1`              |
| **GENERAL_SCRIPT_HANDLE**      | **Required.** Handle for general metafield and extension name                                           | **Must be** `yespo-script`                         |
| **WEB_PUSH_SCRIPT_HANDLE**     | **Required.** Handle for webpush metafield and extension name                                           | **Must be** `yespo-web-push-script`                |
| **DOCK_URL**                   | Yespo dock link                                                                                         | `https://docs.yespo.io`                            |
| **PLATFORM_URL**               | Yespo platform link                                                                                     | `https://my.yespo.io`                              |
| **SERVICE_WORKER_NAME**        | **Required.** Web push service worker file name, in *.js format                                         | **Must be** `service-worker.js`                    |
| **SERVICE_WORKER_PATH**        | **Required.** Relative path on site, where service worker will be stored. Must start and end with slash | `/apps/yespo-proxy/`                               |
| **WEB_TRACKING_ENABLED**       | **Required.** Handle for enabled metafield and extension name                                           | **Must be** `web-tracking-enabled`                 |
| **WEB_TRACKER_URL**            | **Required.** Yespo tracker api url                                                                     | **Must be** `https://tracker.yespo.io/api/v2`      |
| **QSTASH_CURRENT_SIGNING_KEY** | **Required.** QSTASH current signing key                                                                | `sig_5**********************S9aU`                  |
| **QSTASH_NEXT_SIGNING_KEY**    | **Required.** QSTASH next signing key                                                                   | `sig_81*********************WZSrj`                 |
| **HOST_URL**                   | **Required.** App host url metafiedld name for correct work of extension                                | **Must be** `yespo-app-host`                       |
| **REDIS_URL**                  | **Required.** Redis url for connecting and configuring the data synchronization worker                  | `redis://localhost:6379`                           |


#### Required Shopify Scopes
You can [configure app](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) locally with TOML files.
In root directory you need have `shopify.app.toml`  or `shopify.app.{your-config-name}.toml`.
Use shopify app config link to generate additional configuration files for development or staging apps. You can also
re-link upstream Shopify apps if your configuration file gets deleted, corrupted, or out-of-sync. If you already
have a shopify.app.toml in your root directory, then you’ll be prompted to give your configuration file a name, and a
file shopify.app.{your-config-name}.toml is generated in your root directory.

The app requires the following access scopes:
- `read_customers`
- `read_markets`
- `read_orders`
- `read_all_orders`
- `read_themes`
- `write_app_proxy`

#### Webhooks
Shopify webhooks (API version: 2025-07) used by the app:

| Event Topic                | Description                                                                   | Endpoint                      |
|----------------------------|-------------------------------------------------------------------------------|-------------------------------|
| **customers/data_request** | Triggered when a customer requests their personal data under GDPR compliance. | `/webhooks/app/gdpr`          |
| **customers/redact**       | Triggered when a customer requests deletion of their personal data (GDPR).    | `/webhooks/app/gdpr`          |
| **shop/redact**            | Triggered when a store uninstalls the app and requests data erasure.          | `/webhooks/app/gdpr`          |
| **carts/update**           | Triggered whenever a customer updates a cart (e.g. adding/removing items).    | `/webhooks/app/carts`         |
| **customers/create**       | Triggered when a new customer account is created in the store.                | `/webhooks/app/customers`     |
| **customers/update**       | Triggered when an existing customer’s data is updated.                        | `/webhooks/app/customers`     |
| **app/scopes_update**      | Triggered when the app's permission scopes are updated by the merchant.       | `/webhooks/app/scopes_update` |
| **app/uninstalled**        | Triggered when a merchant uninstalls the app.                                 | `/webhooks/app/uninstalled`   |
| **orders/create**          | Triggered when an order is created.                                           | `/webhook/app/orders`         |
| **orders/updated**         | Triggered when an existing order’s data is updated.                           | `/webhook/app/orders`         |
| **carts/update**           | Triggered when a cart is updated in the online store.                         | `/webhooks/app/carts`         |


#### Setup App Proxy
App proxy is used for web push notifications.

- Select yespo app in shopify partner
- Go to `Configuration`
- Find `App proxy` section
- Subpath prefix: `apps`
- Subpath: `yespo-proxy`
- Proxy URL: `https://push.yespo.tech/`


### Development

##### Install dependencies
```shell
npm install
```

##### Database development & migration
```shell
npx prisma generate
npx prisma migrate dev
```

#### Run
```shell
npm run dev
```

### Production
#### Install dependencies
```shell
npm install
```

#### Database development & migration
```shell
npm run setup
```

#### Build
```shell
npm run build
```

#### Run
```shell
npm run start
```

### App Deployment

#### Hosting & Source Code Deployment

You’ll first need to deploy the app’s source code to your hosting provider. This example uses Heroku, and the 
repository includes a [Procfile](https://devcenter.heroku.com/articles/procfile) for Heroku compatibility.
Steps to deploy to Heroku:
1. Login and create a new Heroku app:
```shell
heroku login
heroku create your-app-name
```
2. [Set Environment Variables](https://devcenter.heroku.com/articles/config-vars) in the Heroku dashboard or via CLI.
3. Add [PostgreSQL](https://devcenter.heroku.com/articles/heroku-postgresql):
  - Use the Heroku Postgres add-on
  - Recommended: A plan with at least 10 GB storage
4. Ensure the Procfile is present. The repository already includes one, so no action should be needed here.
5. Commit your changes and push to Heroku:
```shell
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

#### Deployment of Theme Extension & .toml Configuration
After deploying your app backend, you need to deploy the Shopify theme extension and app configuration (shopify.app.toml).
Use the Shopify CLI to deploy both:
```shell
npm run deploy
```
This command will:
- Deploy the Theme App Extension
- Sync the .toml configuration file to Shopify
- Link and register app blocks automatically

Make sure you're authenticated via Shopify CLI and connected to the correct Partner organization and store.

### Using the App

- Install the app in your Shopify store
- [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it to the `Account connection` section
- Connect general script
- Connect webpush script
- Enable/disable web tracking on your site
