# Yespo API — незавершена реалізація

> Документ сформовано на основі аудиту кодової бази відносно специфікації `docs/yespo-api-products-markets.md`.

---

## 1. POST /v1/products та POST /v1/markets — заглушки

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

HTTP-виклики до Yespo закоментовані. Обидва методи повертають mock-успіх і пишуть payload у `debug/`. Дані до Yespo **не відправляються**.

**Що потрібно:**
- Розкоментувати / реалізувати реальний `fetch` до `POST /v1/products`
- Розкоментувати / реалізувати реальний `fetch` до `POST /v1/markets`

---

## 2. Обробка відповідей Yespo

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`, `app/utils/fetchWithErrorHandling.ts`

Поточний код очікує `failedVariants` / `failedItems: string[]`. Yespo повертає:

```json
{
  "requestId": "...",
  "summary": { "received": 3, "accepted": 2, "rejected": 1 },
  "items": [{ "productId": "...", "status": "rejected", "code": "MISSING_REQUIRED_FIELD", "message": "..." }]
}
```

**Що потрібно:**
- Привести типи відповіді до реального формату Yespo (`requestId`, `summary`, `items`)
- Розпарсити `summary.rejected > 0` і `items` з `status: "rejected"`
- Повернути `failedVariants` / `failedItems` з масиву `items`

---

## 3. HTTP 207 — часткова помилка

**Файли:** `app/utils/fetchWithErrorHandling.ts`

`fetchWithErrorHandling` кидає помилку тільки на `!response.ok`. HTTP 207 — це `ok: true`, тому часткові відмови проходять непоміченими.

**Що потрібно:**
- Після успішної відповіді перевіряти `summary.rejected > 0`
- Логувати / повертати `items` з `status: "rejected"` та їх `code` + `message`

---

## 4. HTTP 429 — Rate Limited (retry)

**Файли:** `app/utils/fetchWithErrorHandling.ts`

Є клієнтський throttle (60/хв), але якщо сервер відповів `429`, код просто кидає помилку без повтору.

**Що потрібно:**
- При отриманні `429` — чекати (наприклад, 60 с або `Retry-After` з заголовка) і повторити запит

---

## 5. HTTP 500+ — retry з exponential backoff

**Файли:** `app/utils/fetchWithErrorHandling.ts`

Серверні помилки не повторюються.

**Що потрібно:**
- При `5xx` — retry 2–3 рази з затримкою (наприклад, 1 с → 2 с → 4 с)
- Після вичерпання спроб — кидати помилку і логувати

---

## 6. HTTP 409 — LANGUAGE_CODE_MISMATCH

**Файли:** `app/api/update-product-variants.ts`, `app/worker/handlers/product-sync-handler.ts`

Логіка `languageChanged: true` реалізована тільки в bulk sync, але POST поки що заглушка. У вебхуках `languageChanged` ніколи не передається.

**Що потрібно:**
- При отриманні `409` — повторити запит з `languageChanged: true`
- Передавати `languageChanged` у вебхуках (аналогічно до bulk sync)

---

## ~~7. Translations у вебхуках~~ ✅ Виконано

Реалізовано в `create-product-variant.server.ts` та `update-product-variant.server.ts`:
- `getShopSecondaryLocales` — свіжі локалі з Shopify (виявляє видалені)
- `getProductTranslations` — переклади продукту і варіантів
- `removedLocales` → `remove.translations` у payload
- `createProductVariantPayloadFromWebhook` приймає `translationsResult`

---

## ~~8. Translation categories~~ ✅ Виконано

`get-product-translations.ts` приймає параметр `collections`, виконує батчевий запит перекладів колекцій (Request 2) і заповнює `translations[locale].categories`. Колекції передаються з усіх точок виклику: bulk sync, create-webhook, update-webhook.

---

## 9. Category type та path

**Файли:** `app/worker/services/create-product-variant-payload.ts`, `app/services/create-product-variant-payload-from-webhook.ts`

Всі категорії завжди мають `type: "collection"`. Поле `path` ніколи не заповнюється. В адмін-панелі є UI для налаштувань категорій через метафілди, але він не підключений до sync.

**Що потрібно:**
- Зчитувати метафілд `yespo_category_type` з колекцій і підставляти `type: "category"` або `"collection"` відповідно
- Якщо `type: "category"` — заповнювати `path` (ієрархія з Shopify collection breadcrumb)
- Підключити логіку з `app/lib/category-settings.server.ts` до payload builders

---

## 10. Продукти без колекцій

**Файли:** `app/worker/services/create-product-variant-payload.ts`, `app/services/create-product-variant-payload-from-webhook.ts`

Якщо продукт не має жодної колекції, відправляється `categories: []`. Yespo вимагає мінімум 1 категорію при `action: "create"` — запит буде відхилено.

**Що потрібно:**
- Перед відправкою перевіряти `categories.length === 0`
- Або пропускати такі продукти (з логуванням), або додавати fallback-категорію

---

## ~~11. Market oldPrice — явне очищення~~ ✅ Виконано

`buildMarketProductItem` завжди встановлює `oldPrice` явно: значення, якщо `compareAtPrice > price`, інакше `null` (щоб очистити попереднє значення в Yespo).

---

## ~~12. Market urls — очищення~~ ✅ Виконано

`resolveMarketUrls` + `previousLocalesByMarketId` у bulk sync: `urls: null` коли всі URL зникли; `{ "en": null }` для окремих локалей, що прибрали з ринку.

---

## ~~13. Закоментований DELETE orphan variants у вебхуку~~ ✅ Виконано

`deleteProductVariants` розкоментований в `update-product-variant.server.ts`. При `PRODUCTS_UPDATE` сирітські варіанти видаляються і з Yespo, і з БД.

---

## 14. Перевірка розміру тіла запиту (10 MB)

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

Немає перевірки розміру JSON перед відправкою. Великі каталоги з перекладами можуть перевищити 10 MB.

**Що потрібно:**
- Перед `fetch` вимірювати `Buffer.byteLength(body, "utf8")`
- Якщо > 10 MB — ділити на менші чанки або кидати помилку

---

## 15. Rate limiter — підтримка кількох процесів

**Файл:** `app/utils/rate-limiter.server.ts`

Поточний rate limiter — in-memory. При кількох worker-процесах (concurrency 10 + 3) ліміт не синхронізується між процесами.

**Що потрібно:**
- Перенести стан throttle в Redis (або інше shared storage)
- Або використати зовнішній rate-limit middleware

---

## Виправлено

| Проблема | Файл |
|----------|------|
| DELETE URL `/api/v1/v1/products` | `app/api/delete-product-variants.ts` |
| Translations у вебхуках | `create/update-product-variant.server.ts`, `create-product-variant-payload-from-webhook.ts` |
| removedLocales у вебхуках | `update-product-variant.server.ts` |
| Market sync у вебхуках (contextualPricing) | `app/services/update-market-from-webhook.server.ts` |
| Видалені маркети у вебхуках | `update-market-from-webhook.server.ts` + `MarketSyncRepositoryImpl.deleteManyByKeys` |
| Пагінація варіантів у contextual pricing | `get-product-contextual-pricing.ts` |
| Translation categories (#8) | `get-product-translations.ts` |
| DELETE orphan variants у вебхуку (#13) | `update-product-variant.server.ts` |
