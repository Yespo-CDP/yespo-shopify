# Yespo Shopify App

Shopify app for integration Yespo with Shopify.

### Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo.
- Sync order data (create, update) from Shopify to Yespo.
- Automatically register their store domain in Yespo (to get site and web push scripts).
- Inject site and push scripts into the storefront via Theme App Extensions.
- Install the service worker file for web push notifications using a Shopify App Proxy.
- Send tracking events like MainPage, 404 Page, ProductPage, CustomerData, StatusCart, CategoryPage and PurchasedItems from your store to Yespo.


## Features and Implementation Details

### Widgets

**Purpose:** Register the store domain and inject the Yespo site script into the storefront automatically.

#### Implementation:

- [Register](https://docs.esputnik.com/reference/createdomain) the current store domain in Yespo.
- [Retrieve](https://docs.esputnik.com/reference/getscript) the Yespo site script.
- Store the script content in a Shopify metafield: yespo-script.
- Inject the script into the storefront using a Theme App Extension (./extensions/yespo-extension).

### Web Push Subscription

**Purpose:** Enable customer subscriptions to web push notifications by registering the domain and injecting required scripts.

#### Implementation:

- [Register](https://docs.esputnik.com/reference/addwebpushdomain) the current store domain in Yespo.
- [Retrieve](https://docs.esputnik.com/reference/getscript) the push script and service worker content.
- Store the push script in the yespo-web-push-script metafield.
- Inject the push script into the storefront using the same Theme App Extension.

#### Service Worker Installation:

- A Shopify App Proxy is used to serve the service worker content dynamically from Yespo.
- The worker file is exposed at a predefined path (/apps/yespo/sw.js) to comply with browser requirements.

### Contact Sync (Shopify → Yespo)

**Purpose:** Automatically sync new, updated, and deleted customers from Shopify to Yespo as contacts.
The process covers both historical synchronization and real-time synchronization through Shopify webhooks.

---

#### Implementation:

- App requests access to the following scopes:
  - `read_customers`
  - `write_customers`
- Shopify webhooks used:
  - `customers/create` → creates a new contact in Yespo
  - `customers/update` → updates existing contact data
  - `customers/redact` → removes contact in Yespo

---

#### Enabling contact sync:

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section

When sync is enabled:

- A new synchronization job is added to the **Redis queue**
- A dedicated **worker** processes the job and starts **historical synchronization**
- Runs once after being enabled (or re-enabled)
- Triggered before orders synchronization

---

#### Historical customers sync:

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
     * We update the database to save the clients we synchronize.

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

#### Sync failures:

If a network error or unknown error occurs during sync, the synchronization process will receive status ERROR. This status is displayed in the UI. Sync can be re-enabled in the **Data Sync** section. Data that was successfully synchronized will not be re-synchronized after an error.

---
 
#### Field Mapping [Shopify Customers](https://shopify.dev/docs/api/admin-graphql/latest/queries/customers) →  [Yespo Contacts](https://docs.esputnik.com/reference/contactsbulkupdate-1):
  - `customer.id` → `externalCustomerId`
  - `customer.firstName` → `firstName`
  - `customer.lastName` → `lastName`
  - `customer.defaultEmailAddress.emailAddress` → `channels[type=email].value`
  - `customer.defaultPhoneNumber.phoneNumber` → `channels[type=sms].value`
  - `customer.defaultAddress.phone` (if defaultPhoneNumber doesn't exist) → `channels[type=sms].value`
  - `customer.defaultAddress.city` → `address.town`
  - `customer.defaultAddress.address1` → `address.address`
  - `customer.defaultAddress.zip` → `address.postcode`

---

#### Logging & Status Tracking:

- `totalCount` – total number of customers from Shopify.
- `syncedCount` – customers sent to Yespo.
- `failedCount` – customers rejected by Yespo.
- `skippedCount` – customers who are already synced and skipped during sync, this is not displayed in the UI but is saved in the last sync log.

Final synchronization status:
- `COMPLETE` → all customers processed successfully.
- `ERROR` → shown when a network failure or any unknown error occurs during the synchronization.

---

#### Real-time customers sync:

Webhooks are triggered immediately when events occur in Shopify:

  - `customers/create` → new contact sent to Yespo.
  - `customers/update` → existing contact updated in Yespo.
  - `customers/redact` → contact removed from Yespo.

---
#### Shopify API methods:

- [query /customersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/customerscount) – returns the count of customers for the given shop.
- [query /customers](https://shopify.dev/docs/api/admin-graphql/latest/queries/customers) – returns a list of customers placed in the stores.


#### Yespo API methods:

- [POST /contact](https://docs.esputnik.com/reference/addcontact-1) – creates or updates contact.
- [POST /contacts](https://docs.esputnik.com/reference/contactsbulkupdate-1) – creates or updates contacts.
- [DELETE /contact](https://docs.esputnik.com/reference/deletecontact-1) (erase=true) – removes contact.

### Order Sync (Shopify → Yespo)

**Purpose:** Automatically sync new and updated orders from Shopify to Yespo.
The process covers both historical synchronization and real-time synchronization through Shopify webhooks.

---

#### Implementation:

App requests access to the following scopes:
  - `read_orders`
  - `read_all_orders`

Shopify webhooks used:
  - `orders/updated` → creates or updates existing order data

---

#### Enabling order sync:

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section

When sync is enabled:

- A new job is added to **Redis**
- A worker begins **historical orders synchronization**
- Runs once after being enabled (or re-enabled)
- Triggered after customers synchronization

---

#### Historical orders sync:

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

#### Sync failures:

If a network error or unknown error occurs during sync, the synchronization process will receive status ERROR. This status is displayed in the UI. Sync can be re-enabled in the **Data Sync** section. Data that was successfully synchronized will not be re-synchronized after an error.

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

#### Status Mapping:

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

#### Logging & Status Tracking:

- `totalCount` – total number of orders from Shopify.
- `syncedCount` – orders successfully sent to Yespo.
- `failedCount` – orders rejected by Yespo.
- `skippedCount` – orders that are already synced and skipped during sync, this is not displayed in the UI but is saved in the last sync log.

Final synchronization status:
- `COMPLETE` → all orders processed successfully.
- `ERROR` → shown when a network failure or any unknown error occurs during the synchronization.

---

#### Real-time orders sync:

Webhooks are triggered when orders are created or updated in Shopify:

  - `orders/create` → new order sent to Yespo.
  - `orders/updated` → existing order updated in Yespo.

---

#### Shopify API methods:

- [query /ordersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/orderscount) – returns the count of orders for the given shop.
- [query /orders](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) – returns a list of orders placed in the stores.

#### Yespo API methods:

- [POST /orders](https://docs.esputnik.com/reference/ordersbulkinsert-1) – creates or updates orders.

### Web Tracking
**Purpose:** Allows you to track events within your site.

---

#### Implementation:

- Stores the enable flag in the web-tracking-enabled metafield
- Sends tracking events from the site to Yespo through Theme Extension.

---

#### Enabling web tracking: 

- Open the Yespo app
- Connect your Yespo account
- Make sure that the Theme App Extension is activated as the site script is required
- Enable tracking in the **Web Tracking** section

---

#### Frontend Events:
- **MainPage** – [MainPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#main-page) occurs when user visited Home page of the site
- **404 Page** – [404 Page event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#404-page) occurs when user visited 404 page of the site
- **Status Cart Page** – [StatusCartPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#additional-events-required-for-recommendations-on-the-site) occurs when user visited /cart page of the site
- **Category Page** – [CategoryPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#category) occurs when user visited products collection page of the site
- **ProductPage** – [ProductPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#product-card) occurs when user visited product page of the site and sends payload with product data:
  - productKey – product id
  - price – product price
  - isInStock – indicates if product is in stock
- **CustomerData** – [CustomerData event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#customer) occurs when there is a logged in user on the site and sends payload with customer data:
  - externalCustomerId – customer id
  - user_email – customer email
  - user_name – customer name
  - phone – customer phone

#### Backend Events:
- **StatusCart** - [StatusCart event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#statuscart) 
occurs when CARTS_UPDATE webhook  is triggered and sends payload with cart data.
- **PurchasedItems** - [PurchasedItems event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#purchaseditems)
occurs when ORDERS_CREATE webhook is triggered  and sends payload with purchased products data.

### Category Settings
**Purpose:** Configure collection-to-category mapping for Yespo product feed.

---

#### Implementation:

- Fetches collections from Shopify using [collections query](https://shopify.dev/docs/api/admin-graphql/latest/queries/collections)
- Stores mapping configuration in collection metafields (namespace: `$app`, key: `yespo_category_type`)
- Provides search functionality to filter collections by title
- Supports pagination for large collection lists

---

#### Features:

- **Collection Search** – real-time search with debounce to find collections by title
- **Entity Mapping** – map collections to:
  - Product types from your Shopify catalog
  - Custom categories from Yespo
- **Metafield Storage** – mapping data is stored as JSON in collection metafields
- **Batch Operations** – supports bulk collection management with pagination

---

#### Accessing Category Settings:

- Open the Yespo app
- Navigate to **Category Settings** page
- Use the search field to filter collections
- Select entity type (Product Type or Category) for each collection
- Configure category values and save

---

#### Field Mapping:

Collection mapping data stored in metafield:
```json
{
  "type": "product_type" | "category",
  "value": "selected_value"
}
```

---

#### Shopify API methods:

- [query /collections](https://shopify.dev/docs/api/admin-graphql/latest/queries/collections) – returns list of collections with pagination and search support
- [mutation /metafieldsSet](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsset) – creates or updates collection metafield with mapping data
- [mutation /metafieldsDelete](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsdelete) – removes collection mapping

## Errors handling

Requests are wrapped in the `fetchWithErrorHandling function`, which provides enhanced error management.
This function:
- Sends an HTTP request to the specified URL with optional fetch options.
- Attempts to parse the response as JSON; if parsing fails, it returns the raw text.
- Throws a FetchError if the response status is not OK (i.e., not in the 2xx range).
- Wraps unexpected errors into a FetchError with a status code of 500.

Each specific API call (e.g., createGeneralDomain, createWebPushDomain, getGeneralScript etc.) includes its own error-handling logic to provide meaningful, domain-specific error messages to the user interface.

If the request ends with a non-success status code, the user will see an error message displayed in a toast notification.



## Technologies and Shopify Tools Used

- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router/latest) – provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) – allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) – Theme App Extensions allow the Yespo app to 
seamlessly inject scripts into a merchant’s Theme without manual code edits.
  You can find the extension code in the `./extensions/yespo-extension` directory.
  This extension includes:
  - `blocks/` – contains Liquid files that act as entry points for injecting Yespo scripts into the Theme. These blocks can be enabled via the Shopify Theme editor.
  - `assests/` – contains JavaScript script that sends events using eS.JS.
- [Polaris web components](https://shopify.dev/docs/api/app-home/polaris-web-components) – design system that enables apps to create Shopify-like experiences.
- [Webhooks](https://shopify.dev/docs/api/webhooks?reference=toml) – allows to receive notifications about particular events in a shop such as customer-related changes.
- [Metafields](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces) – 
used for storing tracking and scripts configurations (custom namespace: $app).
- [Yespo Dock](https://docs.yespo.io/docs/integration-with-api) – Yespo API documentation.

## Yespo API Authentication

The app uses a Yespo API key, provided by the merchant during onboarding, to authorize all API requests. The key is stored securely and used for:
- Contacts sync
- Orders sync
- Domain registration
- Scripts retrieval

Full API documentation: https://docs.yespo.io/docs/integration-with-api


## Quick start

### Prerequisites

Before you begin, you'll need the following:

1. **Node.js**: version 20 [Download and install](https://nodejs.org/en/download/) it if you haven't already.
2. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup) if you don't have one.
3. **Test Store**: Set up either a [development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or a [Shopify Plus sandbox store](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store) for testing your app.

### Setup

#### Environment variables:

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
| **HOST_URL**                   | **Required.** App host url metafield name  for the extension to work correctly                          | **Must be** `yespo-app-host`                       |
| **REDIS_URL**                  | **Required.** Redis url for connecting and configuring the data synchronization worker                  | `redis://localhost:6379`                           |


#### Required Shopify Scopes:
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

#### Webhooks:
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


#### Setup App Proxy:
App proxy is used for web push notifications.

- Select yespo app in shopify partner
- Go to `Configuration`
- Find `App proxy` section
- Subpath prefix: `apps`
- Subpath: `yespo-proxy`
- Proxy URL: `https://push.yespo.tech/`


### Development:

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

### Production:
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

### App Deployment:

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

#### Deployment of Theme Extension & .toml Configuration:
After deploying your app backend, you need to deploy the Shopify Theme Extension and app configuration (shopify.app.toml).
Use the Shopify CLI to deploy both:
```shell
npm run deploy
```
This command will:
- Deploy the Theme App Extension
- Sync the .toml configuration file to Shopify
- Link and register app blocks automatically

Make sure you're authenticated via Shopify CLI and connected to the correct Partner organization and store.

### Using the App:

- 📥 Install the app in your Shopify store.
- 🔑 [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it in the `Account connection` section.
- 📜 Connect the general and web push scripts in the `Scripts integration` section.
- 👀 Enable or disable web tracking on your site in the `Web tracking` section.
- 🔄 Enable or disable customers and orders synchronization in the `Data sync` section.

## Contributing

We welcome contributions to the Yespo Shopify App! Whether you're fixing bugs, improving documentation, or adding new features, your contributions are appreciated.

### 🌿 Branch Structure

This project uses **Git Flow** workflow:
- **`main`** - Production-ready code, stable releases
- **`dev`** - Active development branch, all PRs should target this branch
- **Feature branches** - Created from `dev` for new features or fixes

### 🚀 Quick Start

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone git@github.com:ardas/yespo-shopify.git
   cd yespo-shopify
   # Switch to development branch
   git checkout dev
   ```

2. **Set Up Development Environment**
   Follow the Setup section above to configure your environment and start the development server.

### 📝 Making Changes

#### Branch Naming
- `feature/description` - for new features
- `fix/description` - for bug fixes
- `docs/description` - for documentation updates
- `refactor/description` - for code refactoring

#### Commit Messages
Follow conventional commits:
```
type(scope): description

Example:
feat(api): add webhook for customer updates
fix(ui): resolve connection status display issue
docs(readme): update installation instructions
```

#### Pull Request Process

1. **Create a Feature Branch from `dev`**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow our [coding standards](#-coding-standards)
   - Update documentation if needed

3. **Validate Your Changes**
   ```bash
   npm run lint        # Check code style
   npm run build       # Ensure project builds correctly
   ```

4. **Submit Pull Request to `dev`**
   - Push to your fork: `git push origin feature/your-feature-name`
   - Create a Pull Request **targeting the `dev` branch** with:
     - **Clear title** describing the change
     - **Detailed description** explaining:
       - What problem does this solve?
       - What changes were made?
       - How to test the changes?
     - **Screenshots** for UI changes
     - **Link to related issues**

#### Pull Request Template
When creating a PR, use the provided GitHub template that includes all necessary sections for review.

### 🔧 Coding Standards

#### TypeScript & React
- Use **TypeScript** for all new code
- Follow existing patterns and naming conventions
- Use **functional components** with hooks
- Add proper **type definitions** for all props and data structures
- Use **interfaces** for object types (prefix with `I` for implementation interfaces: `IUserRepository`, `IConfigService`)

#### File Organization
```
app/
├── components/          # Reusable UI components
├── services/           # Business logic and API calls
├── repositories/       # Data access layer
│   ├── shop/           # Shop-related repository
│   │   ├── shopRepository.server.ts      # Interface
│   │   └── shopRepositoryImpl.server.ts  # Implementation
│   └── customerData/   # Customer data repository
├── @types/             # TypeScript type definitions
├── utils/              # Helper functions
└── routes/             # React Router routes
```

#### Repository Pattern
```
repositories/
├── shop/
│   ├── shopRepository.server.ts      # Interface
│   └── shopRepositoryImpl.server.ts  # Implementation
└── repositories.server.ts            # Exported instances
```

#### Code Style
- **90 characters** line length (max 120)
- **2 spaces** indentation
- Use **meaningful names** (avoid single letters except in loops)
- Add **error handling** for all API calls

#### Naming Conventions

**Interfaces:**
```typescript
// ✅ Repository/Service interfaces - prefix with I
interface IUserRepository {
  getUser(id: string): Promise<User>;
}

// ✅ Component props - suffix with Props
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
}

// ✅ Data structures - descriptive names
interface ShopData {
  id: string;
  name: string;
}
```

**Classes:**
```typescript
// ✅ Implementation classes - descriptive names
class UserRepositoryImpl implements IUserRepository {
  async getUser(id: string): Promise<User> {
    // Implementation
  }
}
```

#### Component Guidelines
```typescript
// ✅ Good: Clear component structure
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const Button: FC<ButtonProps> = ({ 
  variant, 
  onClick, 
  children, 
  disabled = false 
}) => {
  // Component logic here
};
```

### 🐛 Bug Reports

Found a bug? Help us fix it by providing detailed information.

#### Before Reporting
- Check if the issue already exists in [GitHub Issues](https://github.com/ardas/yespo-shopify/issues)
- Make sure you're using the latest version
- Try to reproduce the issue consistently

#### Bug Report Template
Use the GitHub bug report template when creating an issue. It includes all necessary fields like steps to reproduce, environment details, and expected vs actual behavior.

### 💡 Feature Requests

Have an idea for improvement? We'd love to hear it!

#### Feature Request Template
Use the GitHub feature request template when suggesting new features. It includes sections for problem statement, proposed solution, and implementation ideas.

### 🔒 Security

#### Reporting Security Issues
**Do not report security vulnerabilities through public GitHub issues.**

Instead, please email us directly at: **support@yespo.io**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

#### Security Guidelines for Contributors
- **Never commit** API keys, passwords, or secrets
- Use **environment variables** for all sensitive configuration
- **Validate all inputs** and sanitize user data
- Follow **OWASP security practices**
- Keep dependencies up to date

### 🤝 Community Guidelines

#### Code of Conduct
- **Be respectful** and inclusive
- **Focus on constructive feedback**
- **Help newcomers** feel welcome
- **Assume good intentions**
- **No harassment** or inappropriate behavior

#### Getting Help
- 📖 Check the [documentation](https://docs.yespo.io)
- 💬 Ask questions in GitHub Discussions
- 📧 Contact us at support@yespo.io
- 🐛 Report bugs through GitHub Issues

## 📊 Issue Management

### 🏷️ Labels We Use

| Label | Description | Used For |
|-------|-------------|----------|
| `bug` | Something isn't working | Bug reports |
| `feature` | New feature request | Feature requests |
| `enhancement` | Improvement to existing feature | Enhancements |
| `documentation` | Documentation needs update | Docs updates |
| `good first issue` | Good for newcomers | Beginner-friendly |
| `help wanted` | Extra attention needed | Community help |
| `question` | General questions | Q&A |
| `priority: critical` | Urgent fix needed | Critical bugs |
| `priority: high` | Should be fixed soon | Important issues |
| `priority: medium` | Normal priority | Standard issues |
| `priority: low` | Can wait | Minor issues |
| `status: waiting-for-feedback` | Needs more info | Pending response |
| `status: in-progress` | Being worked on | Active work |
| `scope: api` | Backend/API related | API changes |
| `scope: ui` | Frontend/UI related | UI changes |
| `scope: docs` | Documentation related | Docs changes |

### 📝 Issue Templates

We provide several issue templates to help you report issues effectively:

- **🐛 Bug Report** - For reporting bugs and issues
- **💡 Feature Request** - For suggesting new features
- **❓ Question** - For asking questions about the app

Each template includes specific sections to help us understand and address your request quickly.

## 📞 Support Channels

- **🐛 Found a bug?** → [Create a Bug Report](https://github.com/ardas/yespo-shopify/issues/new?template=bug_report.md)
- **💡 Have a feature idea?** → [Submit a Feature Request](https://github.com/ardas/yespo-shopify/issues/new?template=feature_request.md)
- **❓ Need help?** → [Ask a Question](https://github.com/ardas/yespo-shopify/issues/new?template=question.md)
- **📚 Check documentation** → [docs.yespo.io](https://docs.yespo.io)
- **📧 Direct support** → support@yespo.io
- **🔒 Security issues** → support@yespo.io

---

Thank you for contributing to Yespo Shopify App! 🙏

Your contributions help make Yespo better for everyone. Whether you're reporting bugs, suggesting features, or contributing code, every bit helps! 💙
