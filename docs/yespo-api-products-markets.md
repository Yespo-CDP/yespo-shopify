# Yespo REST API — Products and Markets

> Full reference for the normalized product-ingestion and market-data API.  
> Designed for integrations streaming product data from Shopify, WooCommerce, Horoshop, and similar platforms.

---

## Table of Contents

1. [Methods Overview](#methods-overview)
2. [Limits and Headers](#limits-and-headers)
3. [POST /v1/products — Add / Update Products](#post-v1products--add--update-products)
   - [Request Envelope](#request-envelope-products)
   - [Product Object](#product-object)
   - [Category Object](#category-object)
   - [Translation Object](#translation-object)
   - [ProductRemovePatch Object](#productremovepatch-object)
   - [Product Identity and Tracking Correspondence](#product-identity-and-tracking-correspondence)
   - [Update Logic — Detailed Description](#update-logic--detailed-description)
   - [Clearable Fields](#clearable-fields)
   - [Update Examples](#update-examples)
   - [Language Change Procedure](#language-change-procedure)
4. [DELETE /v1/products — Delete Products](#delete-v1products--delete-products)
   - [Request Envelope](#request-envelope-delete)
   - [Delete Product Object](#delete-product-object)
   - [Delete Examples](#delete-examples)
5. [POST /v1/markets — Add Markets](#post-v1markets--add-markets)
   - [Request Envelope](#request-envelope-markets)
   - [Market Object](#market-object)
   - [Market Product Object](#market-product-object)
   - [Update Semantics](#add-markets-update-semantics)
   - [URL Language Rule](#url-language-rule)
   - [Market Examples](#market-examples)
6. [CSV Feed Mapping](#csv-feed-mapping)
7. [Response Format](#response-format)
   - [Response Object](#response-object)
   - [Item Object](#item-object)
8. [Response Codes](#response-codes)
9. [Error Codes](#error-codes)

---

## Methods Overview

| Method   | Endpoint        | Purpose                                         |
|----------|-----------------|-------------------------------------------------|
| `POST`   | `/v1/products`  | Create or update products (catalog ingestion)   |
| `DELETE` | `/v1/products`  | Delete products                                 |
| `POST`   | `/v1/markets`   | Set market-specific prices, stock, and URLs     |

---

## Limits and Headers

### Request Headers

```
Content-Type: application/json
```

### Limits

| Limit                              | Value   |
|------------------------------------|---------|
| Max items per request              | 1,000   |
| Max body size                      | 10 MB   |
| Max requests per minute per siteId | 60      |
| Validation latency target          | < 5 s   |
| Reflection in recommendations      | < 30 s  |

---

## POST /v1/products — Add / Update Products

This endpoint is the main catalog ingestion API. It handles both initial imports and incremental streaming updates.

**Key behaviors:**
- `action` must be explicitly set to `"create"` or `"update"` per item.
- `create` requires all mandatory fields; if it targets an existing product, update semantics apply (but all create-required fields must still be present).
- `update` only requires changed fields plus always-required fields (`productId`, `action`, `updatedDate`).
- Items are validated independently — one failure does not block the rest.
- A single request can contain up to 1,000 items.

### Request Envelope (products)

```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "languageChanged": false,
  "products": [ Product ]
}
```

| Parameter        | Type    | Required | Description |
|------------------|---------|----------|-------------|
| `siteId`         | String  | Yes      | Client site/account identifier. Max 128 chars. Allowed characters: letters, digits, `.`, `_`, `-`. |
| `languageCode`   | String  | Yes      | Default language for top-level product fields in this request. Must be a BCP 47 language tag (e.g. `"uk"`, `"en"`, `"de"`, `"en-GB"`). Top-level `name`, `description`, `url`, and `categories` are in this language. The server records the `languageCode` from the **first accepted** request for each `siteId` as the site default. Subsequent requests must use the same `languageCode` unless `languageChanged` is `true`. |
| `languageChanged`| Boolean | No       | Must be `true` when intentionally changing the default language for this `siteId`. If `languageCode` differs from the stored site default and `languageChanged` is not `true`, the entire request is rejected with `409 LANGUAGE_CODE_MISMATCH`. Default: `false`. If `languageChanged: true` and the submitted `languageCode` matches the stored default, the flag is treated as a no-op. |
| `products`       | Array   | Yes      | Array of [Product](#product-object). |

### Product Object

```json
{
  "action": "create",
  "productId": "shopify_variant_987",
  "updatedDate": "2026-04-01T12:00:00Z",
  "name": "Men's T-Shirt / Black / M",
  "url": "https://mystore.ua/en/products/tshirt-black-m",
  "imageUrl": "https://cdn.mystore.ua/images/tshirt-black-m.jpg",
  "isInStock": 1,
  "price": 599,
  "currency": "UAH",
  "description": "Plain text description",
  "categories": [ Category ],
  "translations": [ Translation ],
  "tags": {
    "Color": ["Black"],
    "Size": ["M"]
  },
  "remove": ProductRemovePatch
}
```

| Parameter      | Type    | Required on create | Description |
|----------------|---------|--------------------|-------------|
| `action`       | String  | Yes                | `"create"` or `"update"`. |
| `productId`    | String  | Yes                | Unique product identifier within `siteId`. Must match the identifier used in tracking events, recommendation requests, and market data. Max 128 chars. |
| `updatedDate`  | String  | Yes                | Source ordering timestamp. RFC3339 / ISO 8601 UTC (e.g. `2026-04-01T09:07:15Z`). Used to ignore stale out-of-order events during async processing. Prefer source object update time; fall back to webhook event timestamp or detection time. |
| `name`         | String  | Yes                | Display name in the default language. Max 500 chars. |
| `imageUrl`     | String  | Yes                | Main product image URL. Must be a valid absolute URL. Minimum image size: 200×200 px. |
| `isInStock`    | Integer | Yes                | `1` = in stock, `0` = out of stock. Base commercial state used when no market override is present. |
| `url`          | String  | Yes                | Product URL for the default language. Must be a valid absolute URL. |
| `currency`     | String  | Yes                | ISO 4217 currency code for the base commercial state (e.g. `"UAH"`, `"USD"`, `"EUR"`). |
| `price`        | Float   | Yes                | Selling price in the base commercial state. No currency symbol. |
| `categories`   | Array   | Yes                | Array of [Category](#category-object). Minimum 1 element. Names and paths in the default language. On update: provided value replaces all categories; omitted value preserves existing. |
| `itemGroupId`  | String  | No                 | Shared family/group identifier for grouping product variants. Multiple variant `productId` values may share the same `itemGroupId`. Max 128 chars. |
| `oldPrice`     | Float   | No                 | Original price in the base commercial state. If both `oldPrice` and `price` are present and numeric, `oldPrice` must be greater than `price`. |
| `discount`     | Float   | No                 | **Backward-compatibility field only.** The server derives discount from `oldPrice` and `price`. If sent, it is **ignored**. |
| `brand`        | String  | No                 | Brand or manufacturer. Max 256 chars. |
| `description`  | String  | No                 | Plain text in the default language. UTF-8. Max 10,000 chars. HTML is **not** supported. |
| `translations` | Array   | No                 | Array of [Translation](#translation-object) objects. Each element is a dictionary of `languageCode → translation object`. |
| `tags`         | Object  | No                 | Product tags as a key→value map. Keys are tag names (e.g. `"Color"`, `"Size"`), values are arrays of strings. On update: provided key overwrites that tag's value; omitted key preserves existing value. To remove a specific tag use `remove.tags`. |
| `remove`       | Object  | No                 | [ProductRemovePatch](#productremovepatch-object). Explicit remove instructions for update operations. |

### Category Object

```json
{
  "id": "8",
  "name": "T-Shirts",
  "path": ["Clothing", "Tops", "T-Shirts"],
  "type": "category"
}
```

| Parameter | Type   | Required    | Description |
|-----------|--------|-------------|-------------|
| `id`      | String | Conditional | Required if `name` is not provided. |
| `name`    | String | Conditional | Required if `id` is not provided. In the default language. |
| `path`    | Array  | No          | Hierarchy from root to leaf. Max 10 levels. In the default language. |
| `type`    | String | No          | `"category"` — taxonomy/product type, hierarchical, used for category-based recommendations and content filtering. `"collection"` — merchandising group, flat, used for cross-sell and filtering. Default: `"category"` if omitted. |

### Translation Object

Each element of the `translations` array is a dictionary mapping a BCP 47 language code to a translation object:

```json
{
  "en": {
    "name": "Men's T-Shirt",
    "url": "https://mystore.ua/en/tshirt",
    "description": "English description",
    "categories": [ Category ]
  }
}
```

| Parameter     | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `name`        | String | No       | Localized name. |
| `description` | String | No       | Localized plain-text description. UTF-8. Max 10,000 chars. HTML not supported. |
| `url`         | String | No       | Localized URL. Must be a valid absolute URL. |
| `categories`  | Array  | No       | Array of [Category](#category-object) with localized names and paths. Category `id` stays the same. |

> **Important:** Locale objects inside `translations` use **replacement semantics**, not field-level patch. Submitting `{ "en": { "name": "..." } }` replaces the entire English translation with only the submitted fields. Fields previously stored (e.g. English description) are removed if omitted.

### ProductRemovePatch Object

Used in the `remove` field of a Product to explicitly delete specific fields, tags, or translations during an update operation. Sending `null` is **not** used for clearing — use `remove` instead.

```json
{
  "fields": ["oldPrice"],
  "tags": ["Season"],
  "translations": ["en"]
}
```

| Parameter      | Type           | Required | Description |
|----------------|----------------|----------|-------------|
| `fields`       | Array\<String\> | No      | Product fields to remove. Allowed values: `"oldPrice"`, `"description"`, `"brand"`, `"itemGroupId"`, `"translations"` (removes all translations). |
| `tags`         | Array\<String\> | No      | Tag names to remove (keys from the `tags` object). Example: `["Season", "Material"]`. |
| `translations` | Array\<String\> | No      | Language codes of individual translation locales to remove. Example: `["en", "de"]`. |

### Product Identity and Tracking Correspondence

- `productId` must match the entity identifier used by the client's tracking setup.
- If user behavior is tracked on **variant IDs**, then `productId` must be the variant ID.
- If user behavior is tracked on **parent product IDs**, then `productId` must be the parent product ID.
- The same `siteId` must use **one consistent `productId` strategy** across Add products, Add markets, tracking, and recommendation requests.
- For variant-based tracking, `itemGroupId` should contain the shared parent/family identifier.

### Update Logic — Detailed Description

- Products **not included** in the request are preserved unchanged.
- A `create` item targeting an **existing** product is processed with update semantics, but all create-required fields must still be present.
- `update` applies only to the submitted product and may contain only changed fields (plus always-required fields).
- No existence check is performed during request validation.

#### Scalar Fields

| Submitted value              | Behavior |
|------------------------------|----------|
| Omitted                      | Preserved unchanged |
| New value                    | Overwritten |
| `remove.fields: ["field"]`   | Removes the specified clearable field |

> `null` is **not** used for clearing scalar fields — use `remove.fields` instead.

#### Array Fields

| Field / Value                    | Behavior |
|----------------------------------|----------|
| `categories` omitted             | Preserved unchanged |
| `categories` new array           | Full replacement |
| `categories: null`               | **Invalid** — cannot be set to null |
| `tags.{key}` omitted             | Preserved unchanged for that tag |
| `tags.{key}` new array           | Full replacement of that tag only |
| `remove.tags: ["{key}"]`         | Removes that specific tag |

#### Translations

| Submitted value                              | Behavior |
|----------------------------------------------|----------|
| `translations` omitted                       | All translations preserved |
| `remove.fields: ["translations"]`            | All translations removed |
| `translations: [{ "en": { ... } }]`          | English translation fully replaced; other languages preserved |
| `remove.translations: ["en"]`                | English translation removed; other languages preserved |

> **Important:** Locale objects inside `translations` use **replacement semantics**, not field-level patch. Submitting `{ "en": { "name": "..." } }` replaces the entire English translation with only the submitted fields. Fields previously stored (e.g. English description) are removed if omitted.

### Clearable Fields

| Field                                         | How to remove |
|-----------------------------------------------|---------------|
| `oldPrice`                                    | `remove.fields: ["oldPrice"]` |
| `description`, `brand`, `itemGroupId`         | `remove.fields: ["description", "brand", "itemGroupId"]` |
| `tags.{name}`                                 | `remove.tags: ["{name}"]` |
| All translations                              | `remove.fields: ["translations"]` |
| One translation locale                        | `remove.translations: ["en"]` |
| `name`, `url`, `imageUrl`, `price`, `currency`, `isInStock`, `categories`, `updatedDate` | Not removable |

### Update Examples

**Update price for one product:**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:07:00Z",
      "price": 47999.00,
      "oldPrice": 54999.00
    }
  ]
}
```

**Update only one tag (preserve all others):**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:07:30Z",
      "tags": { "Color": ["Black"] }
    }
  ]
}
```

**Remove one tag:**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:07:45Z",
      "remove": { "tags": ["Season"] }
    }
  ]
}
```

**Remove old price (discount is derived by server, do not send):**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:07:45Z",
      "price": 599.00,
      "remove": { "fields": ["oldPrice"] }
    }
  ]
}
```

**Update stock only:**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:08:30Z",
      "isInStock": 0
    }
  ]
}
```

**Add German translation, preserve other locales:**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:08:45Z",
      "translations": [{
        "de": {
          "name": "Herren T-Shirt",
          "url": "https://mystore.ua/de/tshirt"
        }
      }]
    }
  ]
}
```

**Replace English translation completely (omitted fields are removed from that locale):**
```json
{
  "siteId": "my_store",
  "languageCode": "uk",
  "products": [
    {
      "action": "update",
      "productId": "430738",
      "updatedDate": "2026-04-01T10:08:50Z",
      "translations": [{
        "en": {
          "name": "Men's T-Shirt",
          "url": "https://mystore.ua/en/tshirt"
        }
      }]
    }
  ]
}
```

**Remove one translation locale:**
```json
{
  "action": "update",
  "productId": "430738",
  "updatedDate": "2026-04-01T10:09:00Z",
  "remove": {
    "translations": ["en"]
  }
}
```

**Remove all translations:**
```json
{
  "action": "update",
  "productId": "430738",
  "updatedDate": "2026-04-01T10:09:30Z",
  "remove": {
    "fields": ["translations"]
  }
}
```

### Language Change Procedure

If the default language intentionally changes (e.g. from `uk` to `en`):

1. Set `languageChanged: true` in the first request with the new `languageCode`. After this request is accepted, the stored site default updates immediately.
2. Subsequent re-sync batches use the new `languageCode` **without** `languageChanged`.
3. Re-sync the full catalog with complete product payloads in the new default language. Restructure `translations` so the old default language moves into translations if needed.
4. Re-sync Add markets if URL locale keys were added, removed, or changed.

> Until the re-sync completes, the catalog may contain products with mixed stored default languages. Recommendation rendering serves stored content as-is.

**Language change request example:**
```json
{
  "siteId": "my_store",
  "languageCode": "en",
  "languageChanged": true,
  "products": [
    {
      "action": "create",
      "productId": "shopify_variant_987",
      "updatedDate": "2026-04-01T12:00:00Z",
      "name": "Men's T-Shirt / Black / M",
      "url": "https://mystore.ua/en/products/tshirt-black-m",
      "imageUrl": "https://cdn.mystore.ua/images/tshirt-black-m.jpg",
      "isInStock": 1,
      "price": 599.00,
      "currency": "UAH",
      "categories": [
        { "id": "8", "name": "T-Shirts", "path": ["Clothing", "Tops", "T-Shirts"] }
      ],
      "translations": [
        {
          "uk": {
            "name": "Футболка чоловіча / Чорний / M",
            "url": "https://mystore.ua/products/futbolka-cholovicha-black-m"
          }
        }
      ]
    }
  ]
}
```

**Language mismatch error response:**
```json
{
  "errorCode": "LANGUAGE_CODE_MISMATCH",
  "message": "Request languageCode 'en' does not match site default 'uk'. Set languageChanged: true to confirm the change.",
  "storedLanguage": "uk",
  "receivedLanguage": "en"
}
```

---

## DELETE /v1/products — Delete Products

**Key behaviors:**
- Each submitted product item is processed independently.
- Up to 1,000 items per request.
- Idempotent no-op if the product is already absent — `updatedDate` is still required to protect against stale deletes.
- If the source platform does not provide a product-level delete timestamp, use the webhook event timestamp or the time deletion was detected by the plugin.
- If a product is deleted, all its market data is removed automatically.

### Request Envelope (delete)

```json
{
  "siteId": "my_store",
  "products": [ Product ]
}
```

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `siteId`   | String | Yes      | Client site/account identifier. Max 128 chars. |
| `products` | Array  | Yes      | Array of [Delete Product Object](#delete-product-object). |

### Delete Product Object

```json
{
  "productId": "430738",
  "updatedDate": "2026-04-01T10:10:00Z"
}
```

| Parameter     | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `productId`   | String | Yes      | Unique product identifier within `siteId`. |
| `updatedDate` | String | Yes      | Source ordering timestamp. RFC3339 / ISO 8601 UTC. Used to ignore stale out-of-order delete events. |

### Delete Examples

**Delete one product:**
```json
{
  "siteId": "my_store",
  "products": [
    {
      "productId": "430738",
      "updatedDate": "2026-04-01T10:07:00Z"
    }
  ]
}
```

---

## POST /v1/markets — Add Markets

Used for stores operating in multiple markets or regions with different prices and availability.

**Key behaviors:**
- Update model: product-level patch stream.
- `productId` and `updatedDate` are required per item.
- All market fields are patch-based (omit = preserve, `null` behavior varies per field — see table).
- Products not included in the request are not changed.
- Market data may be accepted and stored before the corresponding base product exists. Market data is effective in recommendations only after the matching base product exists.
- To remove a product from recommendations in a specific market, send `isInStock: 0`.
- A market record is effective in recommendation resolution only when the matching base product exists **and** the effective market record has at minimum `price`, `currency`, and `isInStock`.
- `discount` is **not** sent in Add markets. Market discount is derived from `oldPrice` and `price`. To remove market discount, send `oldPrice: null`.
- Send Add products **first**, then Add markets.

### Request Envelope (markets)

```json
{
  "siteId": "my_store",
  "markets": [ Market ]
}
```

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `siteId`   | String | Yes      | Client site/account identifier. Max 128 chars. |
| `markets`  | Array  | Yes      | Array of [Market](#market-object). |

### Market Object

```json
{
  "marketId": "ca",
  "products": [ Product ]
}
```

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `marketId` | String | Yes      | Market identifier — can be country code, city code, Shopify Market handle, or any client-defined key. Must match `marketId` used in recommendation requests. Max 128 chars. Allowed characters: letters, digits, `.`, `_`, `-`. |
| `products` | Array  | Yes      | Array of [Market Product Object](#market-product-object) with market-specific properties. |

### Market Product Object

```json
{
  "productId": "SKU123",
  "updatedDate": "2026-04-01T09:07:15Z",
  "price": 29.99,
  "oldPrice": 39.99,
  "currency": "CAD",
  "isInStock": 1,
  "urls": {
    "en": "https://example.ca/en-ca/sku123",
    "fr": "https://example.ca/fr-ca/sku123"
  }
}
```

| Parameter     | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `productId`   | String  | Yes      | Must use the same identity strategy as Add products and tracking. No base-product existence check is performed during request validation. |
| `updatedDate` | String  | Yes      | Source ordering timestamp for this market item. RFC3339 / ISO 8601 UTC. |
| `price`       | Float   | No       | Market-specific selling price. Omit to preserve. Sending `null` is **invalid**. |
| `currency`    | String  | No       | ISO 4217 currency code. Omit to preserve. Sending `null` is **invalid**. |
| `isInStock`   | Integer | No       | `1` or `0`. Market-specific availability. Omit to preserve. Sending `null` is **invalid**. Use `0` to remove from recommendations in this market. |
| `oldPrice`    | Float   | No       | Market-specific original price. Omit to preserve. Send `null` to explicitly mark no `oldPrice` in this market (base `oldPrice` must not be used for this market when explicitly cleared). If both `oldPrice` and `price` are numeric, `oldPrice` must be greater than `price`. |
| `urls`        | Object  | No       | Dictionary of `languageCode → market-specific URL`. Omit to preserve existing URLs. Send `null` to clear all. Submit locale key to upsert only that locale. Submit `{ "en": null }` to clear only locale `en`. All submitted URL values must be valid absolute URLs. |

> Each submitted market item must include at least one market field to change (`price`, `currency`, `isInStock`, `oldPrice`, or `urls`) in addition to the always-required `productId` and `updatedDate`. Otherwise the item is rejected with `EMPTY_MARKET_PATCH`.

### Add Markets Update Semantics

| Field          | Omit          | `null`                        | New value       |
|----------------|---------------|-------------------------------|-----------------|
| `price`        | Preserve      | **Invalid**                   | Overwrite       |
| `currency`     | Preserve      | **Invalid**                   | Overwrite       |
| `isInStock`    | Preserve      | **Invalid**                   | Overwrite       |
| `oldPrice`     | Preserve      | Clear (no oldPrice for market)| Overwrite       |
| `urls`         | Preserve all  | Clear all                     | —               |
| `urls.{lang}`  | Preserve      | Clear that locale             | Upsert          |

When market-specific URLs are cleared or absent, recommendation rendering falls back to translation URL or base product URL.

### URL Language Rule

Keys in `urls` must use BCP 47 language tags and should correspond to a language already defined in the product (either the default `languageCode` or a language key from `translations`). If `urls` references a language not present in product translations, the request may still be accepted. Rendering falls back to default-language content and uses the provided market URL.

### Market Examples

**Update stock only for one product (preserve market price and currency):**
```json
{
  "siteId": "my_store",
  "markets": [
    {
      "marketId": "ca",
      "products": [
        {
          "productId": "SKU123",
          "updatedDate": "2026-04-01T10:15:00Z",
          "isInStock": 0
        }
      ]
    }
  ]
}
```

**Update price only for one product (preserve stock):**
```json
{
  "siteId": "my_store",
  "markets": [
    {
      "marketId": "ua",
      "products": [
        {
          "productId": "SKU123",
          "updatedDate": "2026-04-01T10:20:00Z",
          "price": 120.00,
          "currency": "UAH"
        }
      ]
    }
  ]
}
```

**Remove market old price and market discount:**
```json
{
  "siteId": "my_store",
  "markets": [
    {
      "marketId": "ua",
      "products": [
        {
          "productId": "SKU123",
          "updatedDate": "2026-04-01T10:25:00Z",
          "oldPrice": null
        }
      ]
    }
  ]
}
```

**Update multiple products in one market:**
```json
{
  "siteId": "my_store",
  "markets": [
    {
      "marketId": "ca",
      "products": [
        {
          "productId": "SKU123",
          "updatedDate": "2026-04-01T10:30:00Z",
          "price": 29.99,
          "currency": "CAD",
          "isInStock": 1
        },
        {
          "productId": "SKU456",
          "updatedDate": "2026-04-01T10:31:00Z",
          "price": 49.00,
          "currency": "CAD",
          "isInStock": 0
        }
      ]
    }
  ]
}
```

**Clear market-specific URLs and fall back to base product URLs:**
```json
{
  "siteId": "my_store",
  "markets": [
    {
      "marketId": "ca",
      "products": [
        {
          "productId": "SKU123",
          "updatedDate": "2026-04-01T10:35:00Z",
          "urls": null
        }
      ]
    }
  ]
}
```

> **Note:** If `salePrice` equals `price` or is absent, send only `price`.

---

## CSV Feed Mapping

| CSV Field      | API Field    |
|----------------|--------------|
| `id`           | `productId`  |
| `marketId`     | `marketId`   |
| `availability` | `isInStock`  |
| `price`        | `oldPrice`   |
| `salePrice`    | `price`      |
| `currency`     | `currency`   |

---

## Response Format

Every request returns a request-level envelope plus item-level results.

**Important:**
- Item results describe **synchronous validation and queue-publishing outcomes only**.
- `accepted` means the item passed synchronous validation and was durably published to the internal queue with broker acknowledgment. It does **not** guarantee downstream persistence.
- State-dependent processing outcomes (stale-event ignore, idempotent duplicate ignore, same-timestamp conflicts) happen asynchronously and are not returned in the immediate HTTP response.
- Items are reported independently — one invalid product does not block the rest of the batch.
- If enqueue outcome is unknown for the request, the server returns `500+` and the client may retry the whole request.

### Response Object

```json
{
  "requestId": "6cd77c96-118f-44f0-b7f7-0d3ab8297e6a",
  "summary": {
    "received": 3,
    "accepted": 2,
    "rejected": 1
  },
  "items": [ Item ]
}
```

| Field       | Type    | Required | Description |
|-------------|---------|----------|-------------|
| `requestId` | String  | Yes      | Server-generated request identifier. Also returned in `X-Request-Id` header. |
| `summary`   | Object  | Yes      | Batch-level counts. |
| `items`     | Array   | Yes      | Array of [Item](#item-object). Item-level processing results, in no guaranteed order. |

**Summary object fields:**

| Field      | Type    | Required | Description |
|------------|---------|----------|-------------|
| `received` | Integer | Yes      | Number of items received in the batch. |
| `accepted` | Integer | Yes      | Number of items accepted and durably enqueued with broker acknowledgment. |
| `rejected` | Integer | Yes      | Number of items rejected during synchronous validation. |

### Item Object

**For POST/DELETE /v1/products:**
```json
{
  "productId": "SKU125",
  "action": "create",
  "status": "rejected",
  "code": "MISSING_REQUIRED_FIELD",
  "message": "imageUrl is required for create"
}
```

**For POST /v1/markets:**
```json
{
  "marketId": "ca",
  "productId": "SKU125",
  "status": "rejected",
  "code": "MISSING_REQUIRED_FIELD",
  "message": "updatedDate is required"
}
```

| Field         | Type   | Required    | Description |
|---------------|--------|-------------|-------------|
| `status`      | String | Yes         | `"accepted"` or `"rejected"`. |
| `code`        | String | Conditional | Present for rejected items. |
| `message`     | String | Conditional | Human-readable explanation for the item result. |
| `productId`   | String | Conditional | Present for products items and markets items when available. If item fails before `productId` can be parsed, may be omitted. |
| `marketId`    | String | Conditional | Present for markets items. |
| `action`      | String | Conditional | Present for products items when available. |
| `updatedDate` | String | Conditional | Echoed when useful for troubleshooting. |

---

## Response Codes

| HTTP Status | Meaning       | When |
|-------------|---------------|------|
| `200`       | All accepted  | Every item passed validation and was durably enqueued. |
| `207`       | Partial       | Some items were rejected or failed queue publishing with known per-item outcome. |
| `400`       | Payload error | Malformed JSON, wrong `eventName`, missing required top-level fields. |
| `409`       | Conflict      | Add products request `languageCode` does not match the stored site default and `languageChanged` is not `true`. |
| `413`       | Too large     | Body larger than 10 MB or more than 1,000 items. |
| `429`       | Rate limited  | Rate limit exceeded. |
| `500+`      | Server error  | Retry with backoff. |

---

## Error Codes

| Code                       | HTTP  | Description |
|----------------------------|-------|-------------|
| `INVALID_PAYLOAD`          | 400   | Malformed JSON, wrong `eventName`, missing `languageCode` for Add products. |
| `LANGUAGE_CODE_MISMATCH`   | 409   | Request `languageCode` does not match the stored site default. Set `languageChanged: true` to confirm the change. |
| `MISSING_productId`        | 207   | `productId` is missing. |
| `MISSING_ACTION`           | 207   | Add products `action` missing or invalid. |
| `MISSING_REQUIRED_FIELD`   | 207   | Required field missing. |
| `INVALID_TYPE`             | 207   | Wrong type. |
| `INVALID_URL`              | 207   | Invalid absolute URL. |
| `INVALID_CURRENCY`         | 207   | Invalid ISO 4217 code. |
| `INVALID_CATEGORIES`       | 207   | Empty categories or missing category `id` and `name`. |
| `INVALID_PRICE`            | 207   | `oldPrice <= price` when both numeric fields are present in the same submitted item. |
| `INVALID_updatedDate`      | 207   | `updatedDate` is present but not a valid RFC3339 / ISO 8601 UTC timestamp. |
| `INVALID_NULL_FIELD`       | 207   | Field cannot be set to `null` in this context (e.g. `price`, `currency`, `isInStock` in markets). |
| `EMPTY_MARKET_PATCH`       | 207   | Add markets item contains no market fields to change. |
| `DUPLICATE_KEY_IN_BATCH`   | 207   | Duplicate logical key appears more than once in the same request. |
| `QUEUE_PUBLISH_FAILED`     | 207   | Item passed validation but failed durable queue publishing with known per-item outcome. |
| `BATCH_SIZE_EXCEEDED`      | 413   | More than 1,000 items. |
| `PAYLOAD_TOO_LARGE`        | 413   | Request body larger than 10 MB. |
| `RATE_LIMITED`             | 429   | Rate limit exceeded. |
