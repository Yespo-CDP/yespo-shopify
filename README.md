# Yespo Shopify App

Shopify app for integration Yespo with Shopify.

### Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo.
- Sync order data (create, update, delete) from Shopify to Yespo.
- Sync product data (create, update, delete) from Shopify to Yespo .
- Sync market-specific data (create, update, delete) from Shopify to Yespo.
- Automatically register their store domain in Yespo (to get site and web push scripts).
- Inject site and push scripts into the storefront via Theme App Extensions.
- Install the service worker file for web push notifications using a Shopify App Proxy.
- Send tracking events like MainPage, 404 Page, ProductPage, CustomerData, StatusCart, CategoryPage and PurchasedItems from your store to Yespo.

## Features and Implementation Details

### Store domains

Each shop stores two domains:

- `shopUrl` — the permanent `*.myshopify.com` host (`myshopifyDomain`). Shopify sessions, webhooks, the Admin API, and background jobs use this host to identify the shop.
- `domain` — the public storefront host (`primaryDomain.host`), the address a customer sees in the browser. For a shop with a custom domain this is that domain (for example `micronutrition.com.ua`). When no custom domain is set, it is the same `*.myshopify.com` host.

`domain` is written when the app is installed or the merchant signs in again (`afterAuth`), and on every `shop/update` webhook (`/webhooks/app/shop_update`, the payload `domain`). If another shop row already holds that host, that row's `domain` is reset to its own `shopUrl` first. `app/uninstalled` resets `domain` to the shop's `*.myshopify.com` host.

Where each host is sent:

- **Site and web push registration** (`POST /site/domains`, `POST /site/webpush/domain`, and the script fetches) use `domain`. Web push is bound to the host the browser is actually on. Extra market hosts are registered the same way; see [Market domains](#market-domains).
- **Yespo logs** put `domain` in the log envelope next to `requestBody`. That includes tracking (`StatusCart`, `PurchasedItems`), contact, order, product, and market sync, and account connection. If `domain` is empty, the log falls back to `shopUrl`.
- **Tracking event bodies** do not contain a domain. `StatusCart` and `PurchasedItems` identify the site with `siteId`. The host appears only in the log envelope.
- **Shopify access token** (`POST /shopify/token`) sends `shopUrl` in the request body. Yespo stores that host with the token. The log label for this call is still the public `domain`; the `*.myshopify.com` host is visible inside `requestBody`.

### Widgets

**Purpose:** Register the store domain and inject the Yespo site script into the storefront automatically.

#### Implementation:

- [Register](https://docs.esputnik.com/reference/createdomain) the public storefront domain (`primaryDomain.host`) in Yespo.
- [Retrieve](https://docs.esputnik.com/reference/getscript) the Yespo site script.
- Store the script content in a Shopify metafield: yespo-script.
- Inject the script into the storefront using a Theme App Extension (./extensions/yespo-extension).

### Web Push Subscription

**Purpose:** Enable customer subscriptions to web push notifications by registering the domain and injecting required scripts.

#### Implementation:

- [Register](https://docs.esputnik.com/reference/addwebpushdomain) the public storefront domain (`primaryDomain.host`) in Yespo.
- [Retrieve](https://docs.esputnik.com/reference/getscript) the push script and service worker content.
- Store the push script in the yespo-web-push-script metafield.
- Inject the push script into the storefront using the same Theme App Extension.

#### Market domains

A shop with Shopify Markets can serve the storefront on more than one host (`shop.de`, `shop.fr`, plus the primary domain). Web push is bound to the host the browser is actually on, so each distinct hostname needs its own Yespo domain and script.

- Enabled markets are read with the Admin [`markets`](https://shopify.dev/docs/api/admin-graphql/latest/queries/markets) query, 250 per page, following `pageInfo.endCursor` until the list ends. Only `enabled` markets contribute `webPresence.rootUrls`.
- `collectStorefrontHosts` turns the primary `domain` and those root URLs into one sorted list of unique lowercased hostnames. Several locale URLs on the same host (`https://shop.de/de` and `https://shop.de/en`) are one domain. Empty and malformed URLs are dropped.
- Each host is registered with `POST /site/webpush/domain`, then its script is fetched. The result is stored in the JSON shop metafield `yespo-web-push-multi-domain` (`$app` namespace) as `{ "hostname": "<script>" }`. The single-domain metafield `yespo-web-push-script` is left as it is.
- The theme block `yespo-script.liquid` reads that JSON and injects the script for `window.location.hostname`. When the multi-domain metafield is empty, it falls back to `yespo-web-push-script`.
- The JSON value is written with `collapseWhitespace: false`, so spaces inside the stored scripts stay intact. Newlines are still removed before the write.

#### Market webhook

`markets/create`, `markets/update`, and `markets/delete` are delivered to `/webhooks/app/markets`. The handler does not trust the webhook body. It reads the current root URLs again and compares those hosts with the keys of `yespo-web-push-multi-domain` (`reconcileMarketWebPushScripts`).

- A host that was not in the metafield is registered and its script is fetched, then added.
- A host that is no longer on an enabled market, and is not the primary domain, is removed from the metafield. The Yespo domain registration is not deleted.
- When the host set is unchanged, the metafield is not written.
- Shops with no API key are skipped. Shops that never installed web push and whose multi-domain metafield is still empty are skipped too.
- If a new host cannot be registered, the handler responds with HTTP 500 and does not write the metafield, so Shopify retries the webhook.

Disabling a market and enabling it again removes that host from the metafield, then adds it back. Registration runs again. Yespo answers that the domain is already registered; `domainAlreadyRegisteredError` is ignored and the script is fetched again. `createWebPushDomain` still logs that response as `ADD_WEB_PUSH_DOMAIN_FAILED` before the error is swallowed. The metafield update itself succeeds.

#### Service Worker Installation:

- A Shopify App Proxy is used to serve the service worker content dynamically from Yespo.
- The worker file is exposed at a predefined path (`/apps/yespo-proxy/service-worker.js`, `SERVICE_WORKER_PATH` + `SERVICE_WORKER_NAME`) to comply with browser requirements.

### Contact Sync (Shopify → Yespo)

**Purpose:** Automatically sync new, updated, and deleted customers from Shopify to Yespo as contacts.
The process covers both historical synchronization and real-time synchronization through Shopify webhooks.

---

#### Implementation:

- App requests access to the following scopes:
  - `read_customers`
- Shopify webhooks used:
  - `customers/create` → creates a new contact in Yespo
  - `customers/update` → updates existing contact data
  - `customers/redact` → removes contact in Yespo when an API key is set and contact sync is enabled; the local `Customer` record is always deleted

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
   * Customers Yespo rejected (`failedContacts`) are not saved as synced, so the next historical sync sends them again. Yespo returns them without `externalCustomerId`, so they are matched by `email`, then by `phone`. If a rejected contact matches nothing, or fewer contacts are matched than rejected, no customer of that batch is saved as synced. The same applies when the response has an `errorMessage`.

5. **Repeat until completion**

   * The process continues page by page until all customers are checked and either skipped or sent.

---

#### Sync failures:

If a network error or unknown error occurs during sync, the synchronization process will receive status ERROR. This status is displayed in the UI. Sync can be re-enabled in the **Data Sync** section. Data that was successfully synchronized will not be re-synchronized after an error

A Shopify error on any page (GraphQL `errors`, a partial response, or `THROTTLED` after the retries) also ends the sync with ERROR. ERROR is set as well when the worker finds no valid offline session or no API key for the shop.

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
  - `customers/redact` → contact removed from Yespo when an API key is set and contact sync is enabled. The local `Customer` record is deleted in any case. This GDPR webhook is handled in the request, not in the queue.

`customers/*`, `orders/*` and `carts/update` webhooks are processed asynchronously. The route only adds a job to the `webhook-events` BullMQ queue and answers `200`. The `worker` process runs the job: up to 5 attempts. `customers/*` jobs wait 65 s before every retry, because Yespo answers a repeated `POST /contact` within 1 minute with 409; other jobs use exponential backoff starting at 5 s. A job is retried only when it throws:

  - `customers/create`, `customers/update` and `orders/updated` throw temporary Yespo errors: 5xx, 429, network errors and timeouts. Other 4xx errors are logged and not retried, and the customer or order is not marked as synced. The exception is a "Duplicated request" error from `POST /contact`: it counts as success and the customer is marked as synced.
  - `orders/delete` throws every Yespo error except 400.
  - `carts/update` (StatusCart) and PurchasedItems log Yespo errors and are not retried.
  - An error outside the Yespo request, such as a failed database query, is retried as well, except inside the StatusCart and PurchasedItems services, which only log it.

A customer or order is not sent when its stored `CustomerSync.updatedAt` / `OrderSync.updatedAt` is newer than `updated_at` in the webhook, so a retried or late webhook does not overwrite newer data. With an equal date, no stored record or no valid `updated_at` it is sent.

The job id is the `X-Shopify-Webhook-Id`, so a repeated delivery is ignored while the first job still exists (until it completes or fails for the last time). The worker reads the shop again, so sync and tracking flags changed after the webhook arrived apply. Failed jobs are removed because the payload holds customer data; the worker logs the failure.

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
  - `orders/create` → sends the PurchasedItems event when web tracking is enabled; otherwise (or when the event was not sent) creates the order data if order sync is enabled
  - `orders/updated` → creates or updates existing order data
  - `orders/delete` → deletes the order in Yespo

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

A Shopify error on any page of orders or line items (GraphQL `errors`, a partial response, or `THROTTLED` after the retries) also ends the sync with ERROR. ERROR is set as well when the worker finds no valid offline session or no API key for the shop.

---
  
Money fields use the buyer currency (`presentmentMoney` / `presentment_currency`), which is the market currency when the order was placed on a market other than the shop currency. If Shopify does not send presentment money, the mapper falls back to shop money (`shopMoney` / `currencyCode`, or the REST shop-currency scalars). The same rule applies to the `orders/updated` webhook (`*_set.presentment_money`) and to the historical GraphQL sync.

#### Field Mapping [Shopify Order](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) →  [Yespo Order](https://docs.esputnik.com/reference/ordersbulkinsert-1):
- `order.id` → `externalOrderId`
- `order.customer.id` → `externalCustomerId`
- `order.customer.firstName` → `firstName`
- `order.customer.lastName` → `lastName`
- `order.customer.defaultEmailAddress.emailAddress` → `email`
- `order.customer.defaultPhoneNumber.phoneNumber` → `phone`
- `order.totalPriceSet.presentmentMoney.amount` → `totalCost`
- `order.totalDiscountsSet.presentmentMoney.amount` → `discount`
- `order.totalShippingPriceSet.presentmentMoney.amount` → `shipping`
- `order.totalTaxSet.presentmentMoney.amount` → `taxes`
- `order.presentmentCurrencyCode` → `currency`
- `order.processedAt`, falling back to `order.createdAt` (converted to UTC) → `date`. The webhook uses `processed_at`, then `created_at`.
- `order.displayFulfillmentStatus` (+ cancelledAt check) → `status`
- `order.shippingAddress` (formatted string) → `deliveryAddress`
- country code of the shipping address, then the billing address, then the customer's default address (lowercase; omitted when none is set) → `marketId`. The webhook first uses the market of the storefront visit stored in `EventData` for the order's cart token.
- `order.lineItems.nodes[]`:
  - `lineItem.variant.id` (numeric), or the numeric `lineItem.id` when the line has no variant → `externalItemId`
  - `lineItem.name` → `name`
  - `lineItem.quantity` → `quantity`
  - `lineItem.originalUnitPriceSet.presentmentMoney.amount` → `cost`
  - product `onlineStoreUrl` (fallback `https://{domain}/products/{handle}`) with `?variant=<id>` → `url` (sent only when known)
  - `variant.image.url` (fallback `product.featuredImage.url`) → `imageUrl` (sent only when known)

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

Webhooks are triggered when orders are created, updated or deleted in Shopify:

  - `orders/create` → when web tracking is enabled, the PurchasedItems event is sent (see [Backend Events](#backend-events)). If web tracking is off or the event was not sent (no cart token or tracking data, no `siteId`, request failed) and order sync is enabled, a separate `ORDERS_UPDATED` job (id from the order id, so it is queued once while it exists) sends the order with `POST /orders`. Its retries do not send PurchasedItems again. This job is skipped also when the last sent order has the same `updated_at`, because `orders/create` is the oldest state and the date has seconds only.
  - `orders/updated` → order created or updated in Yespo. Temporary Yespo errors are retried, and an order older than the last sent one is skipped (see [Real-time customers sync](#real-time-customers-sync)). Before sending, the worker asks Shopify for the order: if it no longer exists (`order: null` without errors), the job ends successfully and nothing is sent. If the check fails, the order is sent.
  - `orders/delete` → order deleted in Yespo (`DELETE /orders?externalOrderId=…`), only when order sync is enabled. Yespo deletes the order asynchronously. The order's `OrderSync` record is deleted as well.

---

#### Shopify API methods:

- [query /ordersCount](https://shopify.dev/docs/api/admin-graphql/latest/queries/orderscount) – returns the count of orders for the given shop.
- [query /orders](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) – returns a list of orders placed in the stores.
- [query /order](https://shopify.dev/docs/api/admin-graphql/latest/queries/order) – checks that the order still exists before `orders/updated` is sent.

#### Yespo API methods:

- [POST /orders](https://docs.esputnik.com/reference/ordersbulkinsert-1) – creates or updates orders.
- [DELETE /orders](https://docs.esputnik.com/reference/removehistoryorders) – deletes an order by externalOrderId (asynchronous).

### Product Sync (Shopify → Yespo)

> **Current status:** product catalog sync is **live**. `POST /v1/products` and `DELETE /v1/products` call Yespo (`app/api/update-product-variants.ts`, `app/api/delete-product-variants.ts`). `POST /v1/markets` calls Yespo as well (`app/api/update-market-products.ts`).

**Purpose:** Automatically sync new, updated, and deleted products from Shopify to Yespo as catalog items.
The process covers both historical synchronization and real-time synchronization through Shopify webhooks.

The sync unit is the **product variant**, not the product. Each Shopify variant becomes one Yespo product (`productId` = numeric variant ID), and all variants of the same Shopify product are grouped together with `itemGroupId` (= numeric product ID).

---

#### Implementation:

App requests access to the following scopes:
  - `read_products` – read products, variants, prices, inventory and collections
  - `read_publications` – filter products by `published_status:published`
  - `read_translations` – read product, collection and variant translations
  - `read_locales` – read the shop primary and secondary locales with one `shopLocales` query (used to resolve the Yespo `languageCode` and which translations to send)
  - `unauthenticated_read_product_listings` – create a Storefront access token and read localized taxonomy categories (Admin `TaxonomyCategory` has no locale)

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

#### Rollout for existing shops:

Active shops that do not already have product sync on are stamped when this migration runs (`productSyncAutoEnable`). Contact and order sync do not matter. The stamp is per database, so local, staging, and production each capture their own shops at deploy time. Shops that already have product sync on are left alone.

After the merchant grants `read_products`, `read_publications`, `read_translations`, `read_locales`, and `unauthenticated_read_product_listings`, product sync is enabled once — from `app/scopes_update`, or from the app home loader if those scopes were already on the session. A banner on the home page says sync is on. Dismissing it hides the banner and does not turn sync off. New installs are not stamped and do not see the banner. Turning product sync off afterwards does not turn it back on.

---

#### Historical products sync:

1. **Counting product variants**

   * Shopify [products query](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) is paginated with `status:active AND published_status:published` (same filter as the sync fetch) and each product's `variantsCount.count` is summed (`totalCount`).

2. **Fetching products in batches**

   * Products are fetched in **chunks of 50** using the [products query](https://shopify.dev/docs/api/admin-graphql/latest/queries/products), filtered by `status:active AND published_status:published`.
   * Each product loads its variants inline (first 100), and any remaining variants are fetched with nested pagination.

3. **Validation by `updatedAt`**

   * For every variant, the most recent of `variant.updatedAt` and `product.updatedAt` is compared with `ProductVariantSync.updatedAt`:

     * If the last attempt was accepted (`syncFailed = false`) and the variant is unchanged → skipped
     * If new, updated, or last rejected (`syncFailed = true`) → added to sync batch. Its `ProductVariantSync` row is written with `syncFailed = true` before the request, so a request that throws is retried on the next run
     * Action is `create` when no local sync record exists or the last attempt was rejected (`syncFailed`). An accepted variant is `update`
     * The same `max(variant.updatedAt, product.updatedAt)` is stored on `ProductVariantSync` so a later Enable without Shopify changes skips the variant (Disable/Enable does **not** clear tracking rows; disconnecting the Yespo account or uninstalling the app does, see [Using the App](#using-the-app))
     * Variants Yespo rejects are still tracked, with `syncFailed = true`. The flag becomes `false` only when that variant's response item has `status: "accepted"`. A rejected item, or a response that does not include its `productId`, leaves `syncFailed` true so the next run sends `create` again

4. **Bulk sending to Yespo**

   * Variants are grouped and sent to Yespo in **chunks of 500** using [Products](https://docs.yespo.io/reference/createorupdateproducts) (`POST /v1/products`).
   * Envelope is `{ languageCode, products }`. `languageCode` is the stored `Shop.defaultLanguageCode`; when it is empty — the Shopify primary locale, or `en` if Shopify does not return it. If the locales cannot be read, products are sent without translations. The language is stored after the first request Yespo accepts, so a later change of the Shopify primary locale does not change it. It is reset when the Yespo account is disconnected or the app is uninstalled. Do **not** send `siteId` or `languageChanged` (the site is resolved from the API key).
   * HTTP `207` partial success is treated as OK; items with `status: "rejected"` increment `failedCount` (e.g. `INVALID_URL` when `imageUrl` is empty).

5. **Deleting orphaned variants**

   * Every variant seen during the run is tracked. After processing, any locally tracked variant that no longer exists in Shopify is removed in Yespo using [Products](https://docs.yespo.io/reference/deleteproducts) (`DELETE /v1/products`). Envelope is `{ products }` — do **not** send `siteId`.
   * Local `ProductVariantSync` and `MarketSync` rows are deleted only for variants Yespo accepted. Rejected variants keep their rows, so the next run retries the delete.
   * This step runs only after every page was read. A failed page ends the run before it, so unread products are never treated as deleted.

---

#### Sync failures:

If a network error or unknown error occurs during sync, the synchronization process will receive status ERROR. This status is displayed in the UI. Sync can be re-enabled in the **Data Sync** section. Data that was successfully synchronized will not be re-synchronized after an error.

A Shopify error on any page of products or variants (GraphQL `errors`, a partial response, or `THROTTLED` after the retries) also ends the sync with ERROR, and orphaned variants are not deleted in that run. ERROR is set as well when the worker finds no valid offline session or no API key for the shop.

---

#### Field Mapping [Shopify Product / ProductVariant](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) →  [Yespo Product](https://docs.yespo.io/reference/createorupdateproducts):
- `variant.id` (numeric) → `productId`
- `product.id` (numeric) → `itemGroupId`
- `variant.updatedAt` (webhook: `variant.updated_at`) is converted to RFC3339 UTC (`…Z`) before sending as `updatedDate`. Shopify REST offsets like `-04:00` are rejected by Yespo (`INVALID_SOURCE_UPDATED_AT`).
- `product.title` (+ ` - {variant.title}` when not `Default Title`) → `name`
- `variant.image.url` (fallback `product.featuredImage.url`) → `imageUrl`. Webhooks use the same order: variant `image_id` in `images[]`, then `product.image.src`, then `images[0].src`. Empty `imageUrl` is rejected by Yespo (`INVALID_URL`).
- `product.onlineStoreUrl` (fallback `https://{domain}/products/{handle}`) → `url`
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
On `update`, the `remove` object (never `null`) is used to clear absent optional fields (`oldPrice`, `description`, `brand`) and removed tag keys. Translation locales are sent when present; they are **not** removed from Yespo if a Shopify locale is later unpublished.

---

#### Categories Mapping:

Each variant must have at least one category. Categories are built from two Shopify sources:

* **Collections** → flat categories with `type: "collection"` (`id` = numeric collection ID, `name` = collection title).
* **Taxonomy category** → hierarchical category with `type: "category"`, where `path` is derived by splitting the Shopify `category.fullName` on `>` (e.g. `"Apparel > Clothing > Tops"` → `["Apparel", "Clothing", "Tops"]`). Translated names for secondary locales come from the Storefront API (`unauthenticated_read_product_listings`): the worker creates a Storefront token and reads `product.category` in that locale.

If a product has no collections or taxonomy category, it falls back to a default `Uncategorized` category so that Yespo's "at least one category" requirement is satisfied.

---

#### Logging & Status Tracking:

The Data Sync card shows variant statistics. Each Shopify variant is sent as its own Yespo product, so the variant total is often higher than the number of products in the shop.

Above the numbers: “Products are synced by variants. Each Shopify variant is sent to Yespo as a separate product.”

- **Variants**
  - **Synchronized** = `syncedCount + skippedCount`
  - **Failed** = `failedCount`
  - **Total** = `totalCount`

Under the row, an info banner explains the product-to-variant relationship:

- **Shopify products** — unique Shopify products that have at least one successfully synced variant (`ProductVariantSync.syncFailed = false`). A product is omitted when every one of its variants failed. The number is not stored on `ProductVariantSyncLog`. The page loader and `/api/sync-logs` compute `COUNT(DISTINCT productId)` for the shop when the card is rendered.
- **These products were synced to Yespo as N variants** — `N` is the same **Synchronized** count as on the Variants row. Failed and Total stay on that row: those counters are variant counts.

Under that banner, when the shop has per-country market logs, a plain line reads “Market synchronization by country.” Each following row is one country, labeled **Variants (CC)** (for example **Variants (DE)**), with the same Synchronized, Failed, Total, and status columns. The section title is **Product and Markets Sync**. Market sync is turned on together with product sync when the shop has at least one enabled market.

**Historical Enable** writes job stats for that run:

- `totalCount` – product variants counted in Shopify (`status:active AND published_status:published`).
- `syncedCount` – variants sent in this run and accepted by Yespo.
- `failedCount` – variants sent in this run and rejected by Yespo.
- `skippedCount` – variants skipped because Shopify `updatedAt` was not newer than `ProductVariantSync.updatedAt` (not shown as its own label; folded into Synchronized).

**Webhooks** (create / update / delete) rebuild the same counters from `ProductVariantSync` after Yespo responds, unless a bulk run is `IN_PROGRESS`:

- `totalCount` – tracked rows for the shop
- `failedCount` – rows with `syncFailed = true`
- `syncedCount` – the rest (`skippedCount` is set to `0`)

The app home page polls `/api/sync-logs` every 3s while product sync is enabled (and while any log is `NOT_STARTED` / `IN_PROGRESS`).

Final synchronization status:
- `COMPLETE` → the run finished without a thrown error (rejected items still count as `failedCount`, not `ERROR`).
- `ERROR` → shown when a network failure or any unknown error occurs during the synchronization.

---

#### Real-time products sync:

Webhooks are triggered when products are created, updated, or deleted in Shopify:

  - `products/create` and `products/update` load the product from the Admin API and send each variant to Yespo. The action is `create` when Yespo has not accepted that variant yet (no `ProductVariantSync` row, or `syncFailed` is true). A previously accepted variant is `update`. Variants removed from the product are deleted in Yespo; their local `ProductVariantSync` and `MarketSync` rows are deleted only when Yespo accepted the delete, otherwise the next webhook for the product or the next historical sync retries it.
  - A variant is skipped when a row exists, `syncFailed` is false, and Shopify's `max(variant.updatedAt, product.updatedAt)` is not newer than `ProductVariantSync.updatedAt`.
  - `syncFailed` becomes false only when the Yespo item for that `productId` has `status: "accepted"`. A rejected item, or a response that does not name the variant, leaves the flag true. The next save then sends `POST /v1/products` again with `action: "create"`. An empty `imageUrl` is a typical rejection (`INVALID_URL`).
  - `products/delete` → all tracked variants of the product removed from Yespo. Local rows are deleted only for variants Yespo accepted; the rest are retried by the next historical sync.

The webhook route only enqueues a BullMQ job (`product-webhooks`) and returns `200`. Jobs for the same product are coalesced and delayed by 8 seconds, so a CSV import's `products/create` followed by `products/update` becomes one run. The worker (`concurrency: 1`) then loads the product from the Admin API — including image, collections, category, and translations — and sends it to Yespo. Image URLs follow the same fallback as historical sync (variant image → featured image). `updatedDate` is normalized to UTC. After Yespo responds, Data Sync counters are refreshed from `ProductVariantSync` (see Logging above). When market sync is on, the same job also sends that product's market prices to Yespo, including when every variant was skipped and `POST /v1/products` was not called. A market request does not create the base product.

---

#### Shopify API methods:

- [query /products](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) – returns products with their variants, collections, and category; also used (with `variantsCount`) to count variants.
- [query /productVariants](https://shopify.dev/docs/api/admin-graphql/latest/queries/productvariants) – follows nested variant pagination beyond the inline page.
- [query /translatableResource](https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableresource) – returns product, collection, and variant translations per locale.

#### Yespo API methods:

- [POST /v1/products](https://docs.yespo.io/reference/createorupdateproducts) – creates or updates products.
- [DELETE /v1/products](https://docs.yespo.io/reference/deleteproducts) – removes products.

### Market Sync (Shopify → Yespo)

> **Current status:** market sync is enabled with product sync when the shop has at least one enabled market, and the Data Sync card shows one log row per country under “Market synchronization by country.” `POST /v1/markets` calls Yespo (`app/api/update-market-products.ts`).

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
- Enable **Product and Markets Sync** in the **Data Sync** section. Market sync turns on with product sync when the shop has at least one enabled market. A shop with no enabled markets keeps market sync off.

When sync is enabled:

- Market synchronization is enqueued automatically right after historical products synchronization completes (`enqueueMarketSyncTaskForShopUrl`)
- A daily BullMQ repeatable job also paces ongoing market synchronization across shops (see scheduling below)
- A dedicated `data-sync-market` worker (`concurrency: 10`) processes the job and calls `POST /v1/markets`
- Each shop has at most one active and one waiting `data-sync-market` job (BullMQ `deduplication` by shop). Requests that arrive before the job starts are merged into it, and a request that arrives during a run starts one more run after it. A job that throws is retried, up to 5 attempts, 1, 2, 4 and 8 minutes apart; a retry is a full shop sync and requests that arrive during the pause are merged into it. It throws, for example, when the shop has an API key but no valid offline session, and when a sync fails before any country can get an `ERROR` log (the markets could not be read, or the cleanup of the last removed market failed). What to sync is kept in the Redis set `market-sync:scope:<shop>`: one market → only that market, anything else → a full shop sync

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
   * The bulk operation result (JSONL) is streamed into the `TmpMarketSync` staging table. Variants not published in a market never reach staging. A published variant with no price is staged without a payload so it is not treated as removed from the catalog.

4. **Mapping & bulk sending to Yespo**

   * Staged rows are read in pages of **1,000** (`STAGING_PAGE_SIZE`), so a batch is never loaded into memory at once. They are mapped to market product items (`price`, `currency`, `isInStock`, `oldPrice`, `urls`), unchanged items are skipped via a content-hash comparison, and the rest are grouped by `marketId` (country code) and sent in **chunks of 500** (`API_CHUNK_SIZE`) using [Markets](https://docs.yespo.io/reference/setmarkets) (`POST /v1/markets`). Items are buffered per country across pages, so each market gets the same request bodies as with a single read (the order of requests across markets may differ). Envelope is `{ markets }` — do **not** send `siteId` (the site is resolved from the API key).
   * After a country's bulk succeeds, `MarketSync` rows for that country whose variant was not in the staging set are marked `isInStock: 0` and the accepted local rows are deleted, except rows created after that bulk started (a product webhook may add a variant the bulk does not have yet). This is how a product removed from the catalog leaves that market's recommendations. A failed bulk does not run this pass.
   * After each batch the per-country log is updated and the batch's staged rows are removed from `TmpMarketSync`, also when the batch fails. Rows left by a crashed or killed worker are deleted by the daily DB cleaner (see below).

---

#### Sync failures:

If a network error or unknown error occurs during sync, the affected countries receive status ERROR (per-country `MarketSyncLog`). Items that were successfully synchronized are not re-sent on the next run, because change detection skips unchanged items. During cleanup, items Yespo rejected keep their local records so they are retried next time.

If the market configuration cannot be read from Shopify (GraphQL `errors`), the run stops before cleanup and sends nothing. No per-country status is written in that case, because the country list is unknown; the job is retried instead (see [Enabling market sync](#enabling-market-sync)).

---

#### Field Mapping [Shopify Product / ProductVariant](https://shopify.dev/docs/api/admin-graphql/latest/queries/products) →  [Yespo Market Product](https://docs.yespo.io/reference/setmarkets):
- `variant.id` (numeric) → `productId`
- `variant.updatedAt` → `updatedDate` (RFC3339 UTC)
- country code → `marketId` (normalized to lowercase at the API boundary)
- `contextualPricing.price.amount` → `price`
- `contextualPricing.price.currencyCode` → `currency`
- `variant.inventoryQuantity` (`null` or `> 0` → `1`, else `0`) → `isInStock`
- `contextualPricing.compareAtPrice.amount` (only when `> price`) → `oldPrice`
- `market.rootUrls[locale]` + `/products/{handle}` → `urls` (a `{ locale: url }` dict)

Notes:
- A market item is only built when it has a `price` and `currency`; otherwise it is skipped (a market record needs `price` + `currency` + `isInStock`).
- `oldPrice`: sent as a number only when compare-at is greater than `price`. Otherwise `remove.fields` includes `"oldPrice"`. `null` is not sent.
- `urls`: absolute locale URLs only (`market.rootUrls[locale]` + `/products/{handle}`). A locale with no URL goes to `remove.urlsTranslations`. A market with no locales clears the whole field via `remove.fields: ["urls"]`. `null` is not sent.

---

#### Change detection (skip logic):

- For every item a SHA-256 **content hash** of `{ price, oldPrice, currency, isInStock, urls, remove }` is computed and compared against the stored `MarketSync.contentHash` for `(productId, variantId, countryCode)`. `MarketSync.productId` is the product GID in both paths.
- Older real-time rows keyed by the numeric product id are still read by the real-time path. Their hash counts as unknown, so the item is sent again, and the numeric row is deleted once Yespo accepts the item.
- **Historical path:** an item is skipped only when the hash matches **and** its `updatedDate` is not newer than the stored `MarketSync.updatedAt`.
- **Real-time path:** an item is skipped when the hash matches.
- Accepted items upsert their `MarketSync` record (hash + updatedAt) so subsequent runs can skip them.

---

#### Market sync scheduling:

A daily BullMQ repeatable job (`cron-jobs` queue → `enqueueMarketSyncTasks`) paces `POST /v1/markets` across shops. The schedule is registered on worker startup via `registerMarketSyncCron()` (`MARKET_SYNC_CRON_PATTERN = "0 3 * * *"` — once per day at 03:00 UTC). Requires the `worker` process and Redis.

- Each tick enqueues every shop that is due. At most **10 shops** sync at once: the concurrency of the `data-sync-market` worker (`MARKET_SYNC_MAX_CONCURRENT_SHOPS`); the rest wait in the queue.
- A shop is skipped when every existing country log is `COMPLETE` and newer than **20h** (`MARKET_SYNC_MIN_INTERVAL_MS`; a country without a log is not counted); never-synced shops and shops with a country in `ERROR` are not throttled.
- A shop with an `IN_PROGRESS` sync is skipped.
- An `IN_PROGRESS` sync older than **5h** is treated as stuck and the shop becomes selectable again (`MARKET_SYNC_STALE_AFTER_MS`).
- Eligible shops (`active`, `isMarketSyncEnabled`, `apiKey != null`) are ordered by the country synced longest ago (never-synced shops first). A shop whose API key cannot be decrypted is logged and skipped, so it does not stop the tick for other shops.
- Only the daily cron applies the 20h interval. Market sync enqueued after historical products sync, by the `markets/*` webhook, or when the app home turns market sync on bypasses it.

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
  - Builds market items, compares hashes against stored `MarketSync` records, and sends **only changed** items via `POST /v1/markets`. Clearing follows the field mapping above: missing `oldPrice` and missing URLs go in `remove`, not `null`.
  - For an enabled country where this product is no longer published, sends `isInStock: 0` and prunes the accepted `MarketSync` rows.
  - For countries removed since the last sync, sends `isInStock: 0` for that product's variants and prunes the local records Yespo accepted; rejected ones stay and are retried.
  - A full Shopify product or variant delete calls `DELETE /v1/products` and removes the local `MarketSync` rows of the variants Yespo accepted (rejected ones stay and are retried). It does not send a market `isInStock: 0`, because deleting the base product already drops its market data.

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

- Stores the enable flag in the database (`isWebTrackingEnabled`) and in the web-tracking-enabled metafield
- Sends tracking events from the site to Yespo through Theme Extension.
- Sends the backend events (StatusCart, PurchasedItems) only while `isWebTrackingEnabled` is on.

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
  - productKey – id of the current product variant
  - price – product price
  - isInStock – indicates if product is in stock
- **CustomerData** – [CustomerData event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#customer) occurs when there is a logged in user on the site and sends payload with customer data:
  - externalCustomerId – customer id
  - user_email – customer email
  - user_name – customer name
  - phone – customer phone

#### Backend Events:

Backend events are sent only while web tracking is enabled (`isWebTrackingEnabled`). The `carts/update` and `orders/create` webhooks are processed by the `worker` through the `webhook-events` queue (see [Real-time customers sync](#real-time-customers-sync)).

- **StatusCart** - [StatusCart event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#statuscart) 
occurs when CARTS_UPDATE webhook  is triggered and sends payload with cart data. The `carts/update` webhook is not market-aware: `price_set.presentment_money` can arrive in the shop currency even when the buyer sees another market currency. So `price` and `price_currency_code` are the variant's market price from the Admin API (`contextualPricing(context: { country })`, country = the cart's `marketId`, see `getMarketVariantPrices`) whenever its currency differs from the webhook's `presentment_money`. The per-unit `discount` is then the webhook's shop-currency discount scaled by market price / shop price (an approximation: it does not reflect per-market discount rules). When the webhook already carries the market currency, or the market price cannot be read (`marketId` is not a country code, Shopify API error), the values come from `price_set.presentment_money`, falling back to `item.price` and `price_set.shop_money`. Line building lives in `buildStatusCartProducts` (`app/services/build-status-cart-products.ts`).
- **PurchasedItems** - [PurchasedItems event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#purchaseditems)
occurs when ORDERS_CREATE webhook is triggered  and sends payload with purchased products data. `productKey` is the line's `variant_id`, or the line item `id` when the line has no variant. `unit_price` and `price_currency_code` come from each line's `price_set.presentment_money`. If that set is missing, `unit_price` falls back to `item.price` and the currency falls back to `presentment_currency`, then `currency`.

Cart-to-session mappings (`EventData`: `cartToken` + Yespo cookie `sc`) expire after 14 days. A daily BullMQ repeatable job (`cron-jobs` → `db-cleaner-tick`, `DB_CLEANER_CRON_PATTERN = "0 0 * * *"` UTC) deletes rows whose `ttl` is in the past. The same job also deletes `TmpMarketSync` staging rows older than `TMP_MARKET_SYNC_TTL_MS` (24 h), left by a market sync whose worker crashed or was killed. The scheduler is registered on worker startup via `registerDbCleanerCron()`. Requires the `worker` process and Redis.

#### Signed storefront requests:

`web-tracking.js` sends the cart-to-session mapping to `POST /public/event-data`. A customer from this request is saved only when the request is signed, so nobody can overwrite another customer:

- Each shop has its own key: HMAC-SHA256 (hex) of the numeric Shopify shop id with `SHOP_ENCRYPTION_KEY`. It is stored in the app-data metafield `yespo.yespo-event-key` (owner `AppInstallation`, no definition, read in Liquid as `app.metafields`) and then in `Shop.publicApiKey`. Despite its name the key is secret: it is never logged or sent to the browser.
- `yespo-script.liquid` builds the JSON string `signedData` (`shop`, `marketId`, `customer`) and signs it with `hmac_sha256`. `web-tracking.js` sends `signedData` and `signature` unchanged. `sc` and `cartToken` are not signed: Liquid does not know them.
- Valid signature: `shop`, `marketId` and `customer` are taken only from `signedData`.
- Invalid signature (including only one of the two fields, malformed JSON or `signedData` over 4 KB): `400 { success: false, error: "Invalid signature" }` and one log line.
- No signature, or the shop has no key yet: the cart is saved, the customer is ignored.

The key is written on install and sign-in (`afterAuth`) and cleared in the database on uninstall. `npm run seed:shop-keys` enqueues a job per active shop without a key (queue `shop-public-key`, processed by the `worker`); the Heroku web process runs it on every start. The web process and the worker must use the same `SHOP_ENCRYPTION_KEY`. When the value changes, a shop gets a new key at its next `afterAuth`. The seeding takes only shops without a key, so on its own it does not update existing keys. To rotate all shops at once, set the new value on both, set `publicApiKey = null` for all shops and then run the seeding; until then the carts of these shops are saved without the customer. After a shop's key changes, its storefront pages opened earlier get 400 until they are reloaded.

### APP Inbox
**Purpose:** Allows you to change the script initialization mode from or to [App Inbox](https://docs.esputnik.com/docs/app-inbox-setting-up)

---

#### Implementation:

- Changes the script initialization mode in the `yespo-script` metafield to enable or disable App Inbox mode.
- Then stores the enable flag in the database (`isAppInboxEnabled`). If the metafield update fails, the flag is not changed.

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
- Aborts each attempt after 30 s (`YESPO_FETCH_TIMEOUT_MS`, headers and body). A timeout is thrown as a FetchError with status 500.
- Retries HTTP `429` up to 3 times (`RATE_LIMIT_MAX_RETRIES`), waiting for the `Retry-After` header (seconds or HTTP date) or 60 s when it is missing (`RATE_LIMIT_DEFAULT_RETRY_AFTER_MS`). After the last retry the `429` is thrown. `5xx` responses are not retried.

Shopify Admin GraphQL requests from the worker use `createClient` (`app/worker/services/create-client.ts`):
- A `THROTTLED` response is repeated after a pause based on the query cost: up to 3 times with pauses up to 10 s in background jobs, once with a pause up to 2 s for requests made without a token manager.
- In background jobs every request takes the shop's current offline token (the Shopify library refreshes it before it expires). On HTTP `401` the token is refreshed and the request is repeated once.
- When more than 10 requests of one job still fail with a rejected token (`MAX_FAILED_TOKEN_REQUESTS`), the job stops with an error. Customer, order, product and market sync then end with ERROR.

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
  - `assets/` – contains JavaScript script that sends events using eS.JS.
  - `snippets/` – `yespo-storefront-sync.liquid`, rendered by the block. It passes shop, page, market, customer, product, collection and cart data to the Yespo script (`eS('addVariables', …)`) and emits cart change events.
  - `locales/en.default.json` – the extension's default locale file.
- [Polaris web components](https://shopify.dev/docs/api/app-home/polaris-web-components) – design system that enables apps to create Shopify-like experiences.
- [Webhooks](https://shopify.dev/docs/api/webhooks?reference=toml) – allows to receive notifications about particular events in a shop such as customer-related changes.
- [Metafields](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces) – 
used for storing tracking and scripts configurations (custom namespace: $app).
- [Yespo Dock](https://docs.yespo.io/docs/integration-with-api) – Yespo API documentation.

## Yespo API Authentication

The app uses a Yespo API key, provided by the merchant during onboarding, to authorize all API requests. The key is encrypted at rest (AES-256-GCM). See [API key encryption](docs/api-key-encryption.md). Encrypt existing keys on staging and verify them **before deploying to production**.

The key is used for:
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

1. **Node.js**: version 22 or newer (`engines` in `package.json`) [Download and install](https://nodejs.org/en/download/) it if you haven't already.
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
| **SCOPES**                     | **Required.** Comma-separated access scopes passed to `shopifyApp({ scopes })`. **Must match** `scopes` in `[access_scopes]` of the app TOML config | `read_all_orders,read_customers,read_orders,read_products,read_themes,write_app_proxy,write_products,read_translations,read_locales,read_publications,read_markets,unauthenticated_read_product_listings` (see [Required Shopify Scopes](#required-shopify-scopes)) |
| **API_URL**                    | **Required.** Yespo api url                                                                             | **Must be** `https://yespo.io/api/v1`              |
| **GENERAL_SCRIPT_HANDLE**      | **Required.** Handle for general metafield and extension name                                           | **Must be** `yespo-script`                         |
| **WEB_PUSH_SCRIPT_HANDLE**     | **Required.** Handle for webpush metafield and extension name                                           | **Must be** `yespo-web-push-script`                |
| **WEB_PUSH_MULTI_DOMAIN_HANDLE** | Handle for the JSON metafield that stores web push scripts by storefront host                         | `yespo-web-push-multi-domain`                      |
| **DOCK_URL**                   | Yespo dock link                                                                                         | `https://docs.yespo.io`                            |
| **PLATFORM_URL**               | Yespo platform link                                                                                     | `https://my.yespo.io`                              |
| **SERVICE_WORKER_NAME**        | **Required.** Web push service worker file name, in *.js format                                         | **Must be** `service-worker.js`                    |
| **SERVICE_WORKER_PATH**        | **Required.** Relative path on site, where service worker will be stored. Must start and end with slash | `/apps/yespo-proxy/`                               |
| **WEB_TRACKING_ENABLED**       | **Required.** Handle for enabled metafield and extension name                                           | **Must be** `web-tracking-enabled`                 |
| **WEB_TRACKER_URL**            | **Required.** Yespo tracker api url                                                                     | **Must be** `https://tracker.yespo.io/api/v2`      |
| **HOST_URL**                   | **Required.** App host url metafield name  for the extension to work correctly                          | **Must be** `yespo-app-host`                       |
| **REDIS_URL**                  | **Required.** Redis url for connecting and configuring the data synchronization worker                  | `redis://localhost:6379`                           |
| **API_KEY_ENCRYPTION_KEY**     | **Required.** AES-256 key for `Shop.apiKey`, 32 bytes encoded as base64. One value per environment; do not rotate it after keys are encrypted. | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| **SHOP_ENCRYPTION_KEY**        | **Required** on web and worker. Key for creating the shop keys that sign storefront requests (see [Signed storefront requests](#signed-storefront-requests)), 32 bytes encoded as base64. One value per environment, the same on web and worker; do not change it without rotating the shop keys (set `publicApiKey = null`, then run the seeding). | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| **ESPUTNIK_URL**               | **Required** in production. Yespo API base URL for the App Inbox contact token; the app appends `/auth/contact/token` | — |
| **LOGGING_URL**                | **Required** in production. Remote log endpoint that receives the app's Yespo log events               | — |
| **CATEGORY_TYPE_HANDLE**       | Collection metafield key for the Category Settings mapping                                              | `yespo_category_type`                              |
| **MARKET_TRACKING_ENABLED**    | Key of the market tracking metafield that the app deletes on account disconnect and on sign-in without an API key | `market-tracking-enabled`                |
| **SHOP_CUSTOM_DOMAIN**         | Optional. Extra shop domain passed to `shopifyApp({ customShopDomains })`                               | —                                                  |


#### Required Shopify Scopes:
You can [configure app](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) locally with TOML files.
In root directory you need have `shopify.app.toml`  or `shopify.app.{your-config-name}.toml`.
Use shopify app config link to generate additional configuration files for development or staging apps. You can also
re-link upstream Shopify apps if your configuration file gets deleted, corrupted, or out-of-sync. If you already
have a shopify.app.toml in your root directory, then you’ll be prompted to give your configuration file a name, and a
file shopify.app.{your-config-name}.toml is generated in your root directory.

Configuration files in this repository:
- `shopify.app.toml` – production app.
- `shopify.app.yespo-staging.toml` – staging app.
- `shopify.app.*-dev.toml` – local development apps. Only this name pattern is ignored by git (`.gitignore`); create your own with `npm run config:link` and give it a name ending in `-dev`.

`npm run config:use -- <config-name>` (`shopify app config use`) makes a file the default for Shopify CLI commands, for example `npm run config:use -- yespo-staging`. `npm run dev` and `npm run deploy` use that default; to use another file for one command, pass it explicitly, for example `npm run deploy -- --config <config-name>`. Keep `[webhooks]` (including `api_version`) and `[access_scopes]` identical in every file. Only the app identity, URLs and dev settings (`[build]`) differ between them.

The app requires the following access scopes (`scopes` in `[access_scopes]`; the `SCOPES` environment variable must have the same value):
- `read_customers`
- `read_markets`
- `read_orders`
- `read_all_orders`
- `read_products`
- `write_products`
- `read_translations`
- `read_locales`
- `read_publications`
- `read_themes`
- `unauthenticated_read_product_listings`
- `write_app_proxy`

#### Webhooks:
Shopify webhooks (API version: 2026-04, `api_version` in `[webhooks]`) used by the app:

| Event Topic                | Description                                                                   | Endpoint                      |
|----------------------------|-------------------------------------------------------------------------------|-------------------------------|
| **customers/data_request** | Triggered when a customer requests their personal data under GDPR compliance. | `/webhooks/app/gdpr`          |
| **customers/redact**       | Triggered when a customer requests deletion of their personal data (GDPR). Deletes the contact in Yespo if contact sync is enabled, and always deletes the local `Customer` record. | `/webhooks/app/gdpr`          |
| **shop/redact**            | Triggered when a store uninstalls the app and requests data erasure.          | `/webhooks/app/gdpr`          |
| **carts/update**           | Triggered whenever a customer updates a cart (e.g. adding/removing items).    | `/webhooks/app/carts`         |
| **customers/create**       | Triggered when a new customer account is created in the store.                | `/webhooks/app/customers`     |
| **customers/update**       | Triggered when an existing customer’s data is updated.                        | `/webhooks/app/customers`     |
| **app/scopes_update**      | Triggered when the app's permission scopes are updated by the merchant.       | `/webhooks/app/scopes_update` |
| **app/uninstalled**        | Triggered when a merchant uninstalls the app. Revokes the Yespo access token, marks the shop inactive, clears its API key, event data key (`publicApiKey`), sync flags, web tracking flag, `siteId`, `orgId` and stored product language, resets `domain` to the `*.myshopify.com` host, and deletes local sync rows, sync logs and sessions. Data in Yespo is kept. | `/webhooks/app/uninstalled`   |
| **shop/update**            | Triggered when shop details change. Updates the stored shop email, name and `domain` (see [Store domains](#store-domains)). | `/webhooks/app/shop_update`   |
| **orders/create**          | Triggered when an order is created.                                           | `/webhook/app/orders`         |
| **orders/updated**         | Triggered when an existing order’s data is updated.                           | `/webhook/app/orders`         |
| **orders/delete**          | Triggered when an order is deleted. Deletes the order in Yespo if order sync is enabled. | `/webhook/app/orders`         |
| **products/create**        | Triggered when a new product is created.                                      | `/webhooks/app/products`      |
| **products/update**        | Triggered when an existing product’s data is updated.                         | `/webhooks/app/products`      |
| **products/delete**        | Triggered when a product is deleted.                                          | `/webhooks/app/products`      |
| **markets/create**         | Triggered when a market is created. Reconciles web push hosts. If market sync is already on, syncs only the new market to Yespo. The first extra market still syncs every enabled market. | `/webhooks/app/markets`       |
| **markets/update**         | Triggered when a market is updated. Reconciles web push hosts with the multi-domain metafield. | `/webhooks/app/markets`       |
| **markets/delete**         | Triggered when a market is deleted. Reconciles web push hosts with the multi-domain metafield. | `/webhooks/app/markets`       |


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

#### Run the worker
Webhooks for customers, orders, carts and products, data sync, market sync and the daily cron jobs are processed by a separate BullMQ worker process. Without it these jobs stay in Redis. Run it in a second terminal (needs `DATABASE_URL` and `REDIS_URL`):
```shell
npm run worker
```

### Production:
#### Install dependencies
```shell
npm ci
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
Run the web process and the worker as two separate long-running processes:
```shell
npm run start   # web
npm run worker  # BullMQ worker
```

### Docker:
The `Dockerfile` builds a Node 22 image: `npm ci --omit=dev`, removes `@shopify/cli`, then `npm run build`. `.env` and `.git` are excluded by `.dockerignore`, so pass the environment variables to the container. The container command is `npm run docker-start` (`npm run setup` + `npm run start`): it runs the web process on port 3000 only and is the only step that runs `prisma generate` and the migrations. The image itself has no generated Prisma client (`npm ci` runs before the schema is copied, and `npm run build` does not generate it), so a worker container from the same image must generate it first, with the same environment: `sh -c "npx prisma generate && npm run worker"`. Migrations are applied by the web container only. `docker-start` does not run `migrate:tokens` or `seed:shop-keys`.

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
4. Ensure the Procfile is present. The repository already includes one, so no action should be needed here. It defines two processes:
   - `web: npm run build && npm run setup && npm run migrate:tokens && (npm run seed:shop-keys || true) && npm run start`. On every start the web process applies database migrations and runs `migrate:tokens`, which enqueues a token-migration job per shop. The worker then exchanges a non-expiring offline token for an expiring one; shops already migrated are skipped. Then `seed:shop-keys` enqueues a job per active shop without a key for [signed storefront requests](#signed-storefront-requests); if it fails, the web process still starts.
   - `worker: npm run worker` – the BullMQ worker. Make sure a worker dyno is running, for example `heroku ps:scale worker=1`.
5. Commit your changes and push to Heroku:
```shell
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

   To deploy the request signing for the first time: set `SHOP_ENCRYPTION_KEY` on web and worker; release the `publicApiKey` migration on its own; release the code and check that no active shop is left without a key (`SELECT count(*) FROM "Shop" WHERE active AND "publicApiKey" IS NULL`); then deploy the theme extension right away. Until the extension is deployed, carts are saved without the customer. To roll back, start with the extension.

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

It deploys the active configuration file (see [Required Shopify Scopes](#required-shopify-scopes)). To deploy a specific app, pass the file explicitly, for example `npm run deploy -- --config yespo-staging` for staging.

Make sure you're authenticated via Shopify CLI and connected to the correct Partner organization and store.

### Using the App:

- 📥 Install the app in your Shopify store.
- 🔑 [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it in the `Account connection` section.
  After connecting, the field shows the key fully masked. Saving the masked value unchanged does not reconnect the account.
- 📜 Connect the general and web push scripts in the `Scripts integration` section.
- 👀 Enable or disable web tracking on your site in the `Web tracking` section.
- 🔄 Enable or disable customers, orders, products and markets synchronization in the `Data sync` section.
- Disconnecting the Yespo account turns off sync and tracking, deletes the script metafields and clears the stored product language and the local customer, order, product and market sync rows and logs, so the next connected account gets a full import. Data already sent to Yespo is not deleted. Uninstalling the app clears this local data as well (see `app/uninstalled` in [Webhooks](#webhooks)).

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
   npm run typecheck   # React Router typegen + tsc --noEmit
   npm test            # Unit tests in tests/ (node:test via tsx)
   npm run build       # Ensure project builds correctly
   ```
   Tests live in `tests/unit/`, mirroring the `app/` paths. CI (`.github/workflows/ci.yml`) runs `npm ci`, `npx prisma generate`, `npm run typecheck` and `npm test` on pull requests to `dev` and `main`, with placeholder `DATABASE_URL` and `REDIS_URL` values that point to no running service.

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
├── worker/             # BullMQ worker (npm run worker): worker.ts, job handlers and services
└── routes/             # React Router routes
tests/
└── unit/               # Tests, mirroring the app/ paths
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
