# Yespo Shopify App

Shopify app for integration Yespo with Shopify.

### Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo.
- Sync order data (create, update) from Shopify to Yespo.
- Sync product data (create, update, delete) from Shopify to Yespo .
- Sync market-specific data (create, update, delete) from Shopify to Yespo.
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

### Product Sync (Shopify → Yespo)

**Purpose:** Automatically sync new, updated, and deleted products from Shopify to Yespo as catalog items.
The process covers both historical synchronization and real-time synchronization through Shopify webhooks.

The sync unit is the **product variant**, not the product. Each Shopify variant becomes one Yespo product (`productId` = numeric variant ID), and all variants of the same Shopify product are grouped together with `itemGroupId` (= numeric product ID).

---

#### Implementation:

App requests access to the following scopes:
  - `read_products` – read products, variants, prices, inventory and collections
  - `read_publications` – filter products by `published_status:published`
  - `read_translations` – read product, collection and variant translations
  - `read_locales` – read the shop primary and secondary locales (used to resolve the Yespo `languageCode` and which translations to send)

Shopify webhooks used:
  - `products/create` → creates new product variants in Yespo
  - `products/update` → updates existing product variants in Yespo
  - `products/delete` → removes product variants in Yespo

---

#### Enabling product sync:

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section

When sync is enabled:

- A new job is added to **Redis**
- A worker begins **historical products synchronization**
- Runs once after being enabled (or re-enabled)
- Triggered after customers and orders synchronization

---

#### Historical products sync:

1. **Counting product variants**

   * Shopify [products query](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) is paginated and each product's `variantsCount.count` is summed to get the total number of variants (`totalCount`).

2. **Fetching products in batches**

   * Products are fetched in **chunks of 50** using the [products query](https://shopify.dev/docs/api/admin-graphql/latest/queries/products), filtered by `status:active AND published_status:published`.
   * Each product loads its variants inline (first 100), and any remaining variants are fetched with nested pagination.

3. **Validation by `updatedAt`**

   * For every variant, the most recent of `variant.updatedAt` and `product.updatedAt` is compared with the local database:

     * If the variant is unchanged → skipped
     * If new or updated → added to sync batch
     * Action is `create` when no local sync record exists, otherwise `update`
     * We update the database to save the variants we synchronize

4. **Bulk sending to Yespo**

   * Variants are grouped and sent to Yespo in **chunks of 500** using [Products](https://docs.yespo.io/reference/createorupdateproducts) (`POST /v1/products`).
   * `languageCode` is resolved from the Shopify primary locale; `languageChanged: true` is sent only on the first batch when the stored language differs.

5. **Deleting orphaned variants**

   * Every variant seen during the run is tracked. After processing, any locally tracked variant that no longer exists in Shopify is removed in Yespo using [Products](https://docs.yespo.io/reference/deleteproducts) (`DELETE /v1/products`) and cleaned up locally.

---

#### Sync failures:

If a network error or unknown error occurs during sync, the synchronization process will receive status ERROR. This status is displayed in the UI. Sync can be re-enabled in the **Data Sync** section. Data that was successfully synchronized will not be re-synchronized after an error.

---

#### Field Mapping [Shopify Product / ProductVariant](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) →  [Yespo Product](https://docs.yespo.io/reference/createorupdateproducts):
- `variant.id` (numeric) → `productId`
- `product.id` (numeric) → `itemGroupId`
- `variant.updatedAt` → `updatedDate` (RFC3339 UTC)
- `product.title` (+ ` - {variant.title}` when not `Default Title`) → `name`
- `variant.image.url` (fallback `product.featuredImage.url`) → `imageUrl`
- `product.onlineStoreUrl` (fallback `https://{domain}/products/{handle}`) + `?variant={id}` → `url`
- `variant.inventoryQuantity` (`null` or `> 0` → `1`, else `0`) → `isInStock`
- `variant.price` → `price`
- `variant.contextualPricing.price.currencyCode` (fallback shop currency) → `currency`
- `variant.compareAtPrice` (only when `> price`) → `oldPrice`
- `product.vendor` → `brand`
- `product.description` (plain text, truncated to 10,000 chars) → `description`
- `variant.selectedOptions` → `tags` (e.g. `{ "Color": ["Black"], "Size": ["M"] }`)
- collections + taxonomy category → `categories`
- `product` / `variant` translations → `translations`

**`discount` is never sent** — Yespo derives it from `oldPrice` and `price`.
On `update`, the `remove` object (never `null`) is used to clear absent optional fields (`oldPrice`, `description`, `brand`), removed tag keys, and removed translation locales.

---

#### Categories Mapping:

Each variant must have at least one category. Categories are built from two Shopify sources:

* **Collections** → flat categories with `type: "collection"` (`id` = numeric collection ID, `name` = collection title).
* **Taxonomy category** → hierarchical category with `type: "category"`, where `path` is derived by splitting the Shopify `category.fullName` on `>` (e.g. `"Apparel > Clothing > Tops"` → `["Apparel", "Clothing", "Tops"]`).

If a product has no collections or taxonomy category, it falls back to a default `Uncategorized` category so that Yespo's "at least one category" requirement is satisfied.

---

#### Logging & Status Tracking:

- `totalCount` – total number of product variants from Shopify.
- `syncedCount` – variants successfully sent to Yespo.
- `failedCount` – variants rejected by Yespo.
- `skippedCount` – variants that are already synced and skipped during sync, this is not displayed in the UI but is saved in the last sync log.

Final synchronization status:
- `COMPLETE` → all variants processed successfully.
- `ERROR` → shown when a network failure or any unknown error occurs during the synchronization.

---

#### Real-time products sync:

Webhooks are triggered when products are created, updated, or deleted in Shopify:

  - `products/create` → all variants of the product sent to Yespo as new products.
  - `products/update` → variants created or updated in Yespo; variants removed from the product are deleted.
  - `products/delete` → all tracked variants of the product removed from Yespo.

Because webhook payloads do not include collections, secondary locales, or translations, these are fetched separately via GraphQL before sending. When market sync is enabled, market data for the affected product is updated right after the product webhook is processed.

---

#### Shopify API methods:

- [query /products](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) – returns products with their variants, collections, and category; also used (with `variantsCount`) to count variants.
- [query /productVariants](https://shopify.dev/docs/api/admin-graphql/latest/queries/productvariants) – follows nested variant pagination beyond the inline page.
- [query /translatableResource](https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableresource) – returns product, collection, and variant translations per locale.

#### Yespo API methods:

- [POST /v1/products](https://docs.yespo.io/reference/createorupdateproducts) – creates or updates products.
- [DELETE /v1/products](https://docs.yespo.io/reference/deleteproducts) – removes products.

### Market Sync (Shopify → Yespo)

**Purpose:** Automatically sync market-specific data (per-country prices, stock and storefront URLs) from Shopify to Yespo so recommendations work correctly across markets.
The process covers both historical synchronization and real-time synchronization through the product webhooks.

Market data is always sent **after** the base products exist in Yespo. A market record becomes active in Yespo recommendations only when the base product exists **and** the market item has `price`, `currency` and `isInStock`. The sync unit is the same as for products — a single **product variant** per country (`productId` = numeric variant ID, `marketId` = country code).

---

#### Implementation:

App requests access to the following scopes:
  - `read_markets` – read enabled markets, their countries/locales/root URLs and per-country contextual pricing
  - `read_publications` – read per-country publication state (`publishedInContext`)

---

#### Enabling market sync:

- Open the Yespo app
- Connect your Yespo account
- Enable sync in the **Data Sync** section (market sync is enabled together with product sync)

When sync is enabled:

- Market synchronization is enqueued automatically right after historical products synchronization completes (`enqueueMarketSyncTaskForShopUrl`)
- A daily BullMQ repeatable job also paces ongoing market synchronization across shops (see scheduling below)
- A dedicated `data-sync-market` worker (`concurrency: 10`) processes the job

---

#### Historical market sync:

1. **Reading market configuration**

   * Enabled markets are read from Shopify using the [markets query](https://shopify.dev/docs/api/admin-graphql/latest/queries/markets). Only `enabled` markets are kept.
   * For each market the app collects its `countries` (region codes), `locales` (web presence default + alternate locales), and `rootUrls` (storefront root URL per locale). The flattened set of all `countries` defines what gets synced.

2. **Cleanup of removed markets**

   * Country codes that were synced before but are no longer present in Shopify are treated as removed. For each, products are marked `isInStock: 0` (Yespo has no market-level delete) and local `MarketSync` / `MarketSyncLog` rows are pruned.
   * Cleanup is paged in batches of **250** (`CLEANUP_PAGE_SIZE`); only rows Yespo accepted are deleted locally, failed ones are kept for the next run.

3. **Fetching contextual pricing**

   * Countries are split into chunks of **≤ 15** (`buildBulkQueryChunks`). For each chunk a Shopify [Bulk Operation](https://shopify.dev/docs/api/usage/bulk-operations/queries) collects per-country `contextualPricing` (price, compareAtPrice, currency) and `publishedInContext`.
   * The bulk operation result (JSONL) is streamed into the `TmpMarketSync` staging table. Variants not published in a market never reach staging.

4. **Mapping & bulk sending to Yespo**

   * Staged rows are mapped to market product items (`price`, `currency`, `isInStock`, `oldPrice`, `urls`), unchanged items are skipped via a content-hash comparison, and the rest are grouped by `marketId` (country code) and sent in **chunks of 500** (`API_CHUNK_SIZE`) using [Markets](https://docs.yespo.io/reference/setmarkets) (`POST /v1/markets`).
   * After each batch the staged rows are removed from `TmpMarketSync` and the per-country log is updated.

---

#### Sync failures:

If a network error or unknown error occurs during sync, the affected countries receive status ERROR (per-country `MarketSyncLog`). Items that were successfully synchronized are not re-sent on the next run, because change detection skips unchanged items. During cleanup, items Yespo rejected keep their local records so they are retried next time.

---

#### Field Mapping [Shopify Product / ProductVariant](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) →  [Yespo Market Product](https://docs.yespo.io/reference/setmarkets):
- `variant.id` (numeric) → `productId`
- `variant.updatedAt` → `updatedDate` (RFC3339 UTC)
- country code → `marketId` (normalized to lowercase at the API boundary)
- `contextualPricing.price.amount` → `price`
- `contextualPricing.price.currencyCode` → `currency`
- `variant.inventoryQuantity` (`null` or `> 0` → `1`, else `0`) → `isInStock`
- `contextualPricing.compareAtPrice.amount` (only when `> price`) → `oldPrice`
- `market.rootUrls[locale]` + `/products/{handle}?variant={id}` → `urls` (a `{ locale: url }` dict)

Notes:
- A market item is only built when it has a `price` and `currency`; otherwise it is skipped (a market record needs `price` + `currency` + `isInStock`).
- `oldPrice`: in the **historical** path it is always set explicitly — a value when valid, otherwise `null` to clear a removed `compareAtPrice`. In the **real-time** path it is set only when valid.
- `urls`: built per market locale (locale subfolder is already baked into the market root URL). `null` clears all URLs; a per-locale `null` clears only that locale. Locales removed from a market since the last sync are explicitly nulled out.

---

#### Change detection (skip logic):

- For every item a SHA-256 **content hash** of `{ price, oldPrice, currency, isInStock, urls }` is computed and compared against the stored `MarketSync.contentHash` for `(productId, variantId, countryCode)`.
- **Historical path:** an item is skipped only when the hash matches **and** its `updatedDate` is not newer than the stored `MarketSync.updatedAt`.
- **Real-time path:** an item is skipped when the hash matches.
- Accepted items upsert their `MarketSync` record (hash + updatedAt) so subsequent runs can skip them.

---

#### Market sync scheduling:

A daily BullMQ repeatable job (`cron-jobs` queue → `enqueueMarketSyncTasks`) paces `POST /v1/markets` across shops. The schedule is registered on worker startup via `registerMarketSyncCron()` (`MARKET_SYNC_CRON_PATTERN = "0 0 * * *"` — once per day at 00:00 UTC). Requires the `worker` process and Redis.

- At most **10 shops** sync at once (`MARKET_SYNC_MAX_CONCURRENT_SHOPS`).
- Shops whose last `COMPLETE` sync finished less than **24h** ago are skipped (`MARKET_SYNC_MIN_INTERVAL_MS`); never-synced and last-`ERROR` shops are not throttled.
- An `IN_PROGRESS` sync older than **5h** is treated as stuck and the shop becomes selectable again (`MARKET_SYNC_STALE_AFTER_MS`).
- Eligible shops (`active`, `isMarketSyncEnabled`, `apiKey != null`) are ordered by oldest last sync (never-synced first).
- The post-products-sync trigger bypasses the 24h interval.

The `data-sync-market` worker `concurrency: 10` is the real parallelism cap.

---

#### Logging & Status Tracking:

A `MarketSyncLog` is written **per country** (unique per `shopId` + `countryCode`):

- `totalCount` – market items considered for that country.
- `syncedCount` – items successfully sent to Yespo.
- `failedCount` – items rejected by Yespo.
- `skippedCount` – unchanged items skipped via change detection.

Final synchronization status (per country):
- `IN_PROGRESS` → set while the batch is running.
- `COMPLETE` → all items for the country processed successfully.
- `ERROR` → shown when a network failure or any unknown error occurs during the synchronization.

The real-time (webhook) path sends changed market items immediately but does not write `MarketSyncLog`.

---

#### Real-time market sync:

After a `products/create` or `products/update` webhook is processed (when market sync is enabled), `updateMarketFromWebhook` runs for that single product:

  - Fetches the active markets config and per-country contextual pricing for the product's variants.
  - Skips variants not published in a given market.
  - Builds market items, compares hashes against stored `MarketSync` records, and sends **only changed** items via `POST /v1/markets`.
  - For countries removed since the last sync, sends `isInStock: 0` for that product's variants and prunes the local records.

---

#### Shopify API methods:

- [query /markets](https://shopify.dev/docs/api/admin-graphql/latest/queries/markets) – returns enabled markets with their regions (countries), web presence locales, and root URLs.
- [query /products](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) – via Bulk Operations, returns per-country `contextualPricing` and `publishedInContext`.

#### Yespo API methods:

- [POST /v1/markets](https://docs.yespo.io/reference/setmarkets) – sets market-specific prices, stock and URLs.

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

### APP Inbox
**Purpose:** Allows you to change the script initialization mode from or to [App Inbox](https://docs.esputnik.com/docs/app-inbox-setting-up)

---

#### Implementation:

- Stores the enable flag to the database isAppInboxEnabled.
- Change the script initialization mode to enable or disable App Inbox mode.

#### Enabling App Inbox mode:

- Open the Yespo app
- Connect your Yespo account
- Make sure that the Theme App Extension is activated as the site script is required
- Enable App Inbox mode in the **APP Inbox** section

---

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
- Products sync
- Markets sync
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
- `read_products`
- `read_translations`
- `read_locales`
- `read_publications`
- `read_themes`
- `write_app_proxy`

#### Webhooks:
Shopify webhooks (API version: 2025-10) used by the app:

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
| **products/create**        | Triggered when a new product is created.                                      | `/webhooks/app/products`      |
| **products/update**        | Triggered when an existing product’s data is updated.                         | `/webhooks/app/products`      |
| **products/delete**        | Triggered when a product is deleted.                                          | `/webhooks/app/products`      |
| **carts/update**           | Triggered when a cart is updated in the online store.                         | `/webhooks/app/carts`         |


#### Setup App Proxy:
App proxy is used for web push notifications.

- Select yespo app in shopify partner
- Go to `Configuration`
- Find `App proxy` section
- Subpath prefix: `apps`
- Subpath: `yespo-proxy`
- Proxy URL: `https://push.yespo.tech/`

### Supported Languages
The UI language follows the Shopify Admin locale. If the locale is not supported, the app falls back to `en`.

Supported languages:
- English (`en`)
- Polish (`pl`)
- Portuguese (`pt`)
- Spanish (`es`)
- Italian (`it`)
- German (`de`)
- French (`fr`)

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
- 🔄 Enable or disable customers, orders, products and markets synchronization in the `Data sync` section.

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
