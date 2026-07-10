# Yespo API — незавершена реалізація

> Документ сформовано на основі аудиту кодової бази відносно специфікації `docs/yespo-api-products-markets.md`.
> Останнє оновлення статусів: 2026-06-26.

---

## Підсумок статусів

| # | Пункт | Статус |
|---|-------|--------|
| 1 | POST /v1/products та /v1/markets — реальний fetch | ❌ Відкрито (заглушка) |
| 2 | Парсинг відповіді Yespo (типи + derive) | ✅ Готово (працює на mock, активується з #1) |
| 3 | HTTP 207 — часткова помилка | ✅ Готово (rejected items derive на call-site; активується з #1) |
| 4 | HTTP 429 — retry | ❌ Відкрито |
| 5 | HTTP 500+ — retry з backoff | ❌ Відкрито |
| 6 | HTTP 409 — LANGUAGE_CODE_MISMATCH | 🟡 Частково (bulk-retry написано/закоментовано; вебхуки не передають `languageChanged`) |
| 7 | Translations у вебхуках | ✅ Готово |
| 8 | Translation categories | ✅ Готово |
| 9 | Category `type` та `path` | 🟡 Частково (`type:"category"`+`path` через таксономію; метафілд-override не підключено) |
| 10 | Продукти без колекцій | ❌ Відкрито |
| 11 | Market `oldPrice` — явне очищення | ✅ Готово |
| 12 | Market `urls` — очищення | ✅ Готово |
| 13 | DELETE orphan variants у вебхуку | ✅ Готово |
| 14 | Перевірка розміру тіла (10 MB) | ⏸️ Свідомо пропущено |
| 15 | Rate limiter для кількох процесів | ✅ Готово (Redis) |
| 16 | Прибрати/сховати debug-дампи URL | ❌ Відкрито (нове) |

**Залишилось зробити:** #1, #4, #5, #10, #16 (повністю) + дозакрити #6 (вебхуки) та #9 (метафілд-override). Пункт #14 свідомо пропущено.

---

## 1. POST /v1/products та POST /v1/markets — заглушки

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

HTTP-виклики до Yespo закоментовані. Обидва методи повертають mock-успіх і пишуть payload у `debug/`. Дані до Yespo **не відправляються**.

**Що потрібно:**
- Розкоментувати / реалізувати реальний `fetch` до `POST /v1/products`
- Розкоментувати / реалізувати реальний `fetch` до `POST /v1/markets`

---

## ~~2. Обробка відповідей Yespo~~ ✅ Готово (активується з #1)

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

Типи реального формату Yespo та логіка парсингу вже реалізовані:
- `YespoProductsRawResponse` / `YespoMarketsRawResponse` (`requestId`, `summary`, `items`)
- `deriveFailedVariants` / `deriveFailedItems` — відбирають `items` зі `status: "rejected"`
- Зараз працюють на емульованій (mock) відповіді; реальний шлях написано і закоментовано поряд із fetch у #1.

**Залишилось:** активувати разом з розкоментуванням fetch (#1).

---

## ~~3. HTTP 207 — часткова помилка~~ ✅ Готово (активується з #1)

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

`fetchWithErrorHandling` пропускає `207` (бо `ok: true`), а часткові відмови виявляються на рівні виклику через `deriveFailedVariants` / `deriveFailedItems` (повертають `failedVariants` / `failedItems` з `code` + `message`). Закоментований реальний шлях логує `summary.accepted/rejected`.

**Залишилось:** активувати разом з #1.

---

## ~~4. HTTP 429 — Rate Limited (retry)~~ ✅ Готово

**Файли:** `app/utils/fetchWithErrorHandling.ts`, `app/config/constants.ts`

`fetchWithErrorHandling` тепер при отриманні `429` чекає й повторює запит до `RATE_LIMIT_MAX_RETRIES` разів. Час очікування береться із заголовка `Retry-After` (підтримуються формати delay-seconds та HTTP-date), а за його відсутності — `RATE_LIMIT_DEFAULT_RETRY_AFTER_MS` (60 с, відповідає ліміту 60 req/min). Після вичерпання спроб кидається останній `429`.

---

## 5. HTTP 500+ — retry з exponential backoff

**Файли:** `app/utils/fetchWithErrorHandling.ts`

Серверні помилки не повторюються.

**Що потрібно:**
- При `5xx` — retry 2–3 рази з затримкою (наприклад, 1 с → 2 с → 4 с)
- Після вичерпання спроб — кидати помилку і логувати

---

## 6. HTTP 409 — LANGUAGE_CODE_MISMATCH 🟡 Частково

**Файли:** `app/api/update-product-variants.ts`

Retry на `409` з `languageChanged: true` уже написаний у `updateProductVariants` (закоментований поряд із fetch — активується з #1).

Передача `languageChanged` у вебхуках уже реалізована: `create-product-variant.server.ts` та `update-product-variant.server.ts` рахують його через `resolveProductSyncLanguage` (та сама логіка, що й bulk sync) і передають у `updateProductVariants`, а також обробляють `languageChangedConfirmed` із відповіді.

**Залишилось:**
- Активувати retry разом з #1 (розкоментувати блок fetch + обробку 409)

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

## 9. Category type та path 🟡 Частково

**Файли:** `app/worker/services/map-yespo-categories.ts`, `app/lib/category-settings.server.ts`

`map-yespo-categories.ts` уже генерує:
- колекції → `type: "collection"` (плоскі)
- стандартну таксономічну категорію Shopify → `type: "category"` з `path` (з breadcrumb `fullName`)

Тобто `type:"category"` + `path` уже заповнюються — через таксономію продукту.

**Залишилось:**
- Підключити метафілд-override (`yespo_category_type` із `category-settings.server.ts`), щоб мерчант міг вручну перемикати `category`/`collection` для колекцій

---

## ~~10. Продукти без колекцій~~ ✅ Виконано

Якщо продукт не має жодної колекції та таксономічної категорії, обидва білдери payload (`create-product-variant-payload.ts` та `create-product-variant-payload-from-webhook.ts`) тепер підставляють fallback-категорію `DEFAULT_YESPO_CATEGORY` (`{ name: "Uncategorized", type: "category" }`, без `id`) через спільний хелпер `withDefaultCategory` із `map-yespo-categories.ts`. Порожній `categories` логуюється через `console.warn` перед підстановкою.

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

## 14. Перевірка розміру тіла запиту (10 MB) ⏸️ Свідомо пропущено

**Файли:** `app/api/update-product-variants.ts`, `app/api/update-market-products.ts`

Немає перевірки розміру JSON перед відправкою. Рішенням команди наразі **не реалізуємо** (батчі 500 елементів зазвичай тримаються нижче ліміту). Лишаємо як відоме обмеження.

---

## ~~15. Rate limiter — підтримка кількох процесів~~ ✅ Готово

**Файл:** `app/utils/rate-limiter.server.ts`

Rate limiter перенесено з in-memory на **Redis** (sliding window через ZSET + атомарний Lua-скрипт). Тепер ліміт 60 req/min per siteId спільний для всіх воркер-процесів. Сигнатура `throttleApiRequest(siteId, maxPerMinute?)` не змінилась — виклики правити не потрібно. При недоступності Redis — fail-open (лог + пропуск), щоб не блокувати пайплайн. Додано пряму залежність `ioredis`.

---

## 16. Прибрати/сховати debug-дампи URL (тимчасова діагностика)

**Файли:** `app/worker/services/debug-market-urls.server.ts`, `app/worker/services/resolve-market-urls.ts`, `app/worker/services/fetch-shop-markets-config.ts`

Додано тимчасове логування для діагностики market-URL: дампи у `debug/market-rooturls-*.json` та `debug/resolved-market-urls-*.json`. На проді не потрібні.

**Що потрібно:**
- Сховати виклики `dumpMarketsRootUrlsDebug` / `appendResolvedUrlDebug` за env-флагом (напр. `DEBUG_MARKET_URLS`) або видалити після завершення діагностики

---

## Щоденний крон синхронізації маркетів (ліміт 10 магазинів) ✅ Реалізовано

Крон запускається **раз на добу** (`MARKET_SYNC_CRON_PATTERN = "0 0 * * *"`, 00:00 UTC) через
**BullMQ repeatable job** (не QStash) і тримає **максимум 10 магазинів** у синхронізації
одночасно, віддаючи перевагу магазинам, які синхронізувались найдавніше.

**Файли:**
- `app/config/constants.ts` — константи (включно з `MARKET_SYNC_CRON_PATTERN`)
- `app/services/queue.ts` — `CronQueue`, `registerMarketSyncCron()`, логіка вибірки/постановки в чергу
- `app/worker/worker.ts` — реєстрація scheduler при старті + `cron-jobs` worker
- `app/repositories/marketSyncLog/*` — `hasFreshInProgressByShop`
- `app/repositories/shop/*` + `app/@types/shop.d.ts` — `getShopsForMarketSync` + тип `ShopWithMarketSyncLogs`

**Константи** (`app/config/constants.ts`):
- `MARKET_SYNC_MAX_CONCURRENT_SHOPS = 10` — максимум магазинів в обробці одночасно.
- `MARKET_SYNC_STALE_AFTER_MS = 5 * 60 * 60 * 1000` — 5 годин; `IN_PROGRESS` старіший за це
  вважається «застряглим» (напр. перезапущений воркер), не рахується в бюджеті й дозволяє
  магазину знову потрапити у вибірку.

**Поняття:**
- Одиниця синхронізації — **магазин** (усі його країни синхронізуються одним проходом
  `marketSyncHandler`); ліміт «10» рахується по магазинах, а не по країнах.
- Магазин «в процесі» (`isFreshInProgress`) — має хоч одну `MarketSyncLog` зі
  `status = IN_PROGRESS` і **свіжим** `updatedAt` (`>= staleBefore`). Застряглі ігноруються.
- «Найдавніше синхронізований» (`lastSyncedAt`) — `max(updatedAt)` серед `MarketSyncLog`
  магазину; якщо логів нема — `null` (ніколи не синхронізувався, найвищий пріоритет).

**Алгоритм `enqueueMarketSyncTasks()` (на кожен виклик):**
1. `staleBefore = now - MARKET_SYNC_STALE_AFTER_MS`.
2. `getShopsForMarketSync()` повертає eligible-магазини (`active`, `isMarketSyncEnabled`,
   `apiKey != null`) разом з їхніми `marketSyncLogs` (`status`, `updatedAt`).
3. `inProgressCount` = к-ть магазинів зі свіжим `IN_PROGRESS`.
4. `budget = 10 - inProgressCount`; якщо `budget <= 0` — нічого не ставимо, повертаємо `0`.
5. Кандидати = магазини без свіжого `IN_PROGRESS`; сортуємо: спершу `lastSyncedAt = null`,
   далі за `lastSyncedAt` за зростанням (найдавніші — першими); беремо перші `budget`.
6. Для кожного кандидата — `enqueueMarketSyncJobIfEligible(shop)`.

**`enqueueMarketSyncJobIfEligible(shop)`** (guard перед постановкою в чергу): пропускає, якщо
нема `apiKey`; повторно перевіряє свіжий `IN_PROGRESS` через `hasFreshInProgressByShop`
(захист від гонок); пропускає, якщо нема offline-токена; інакше ставить job у
`DataSyncMarketQueue`. Цей же guard використовується після historical product sync
(`enqueueMarketSyncTaskForShopUrl`).

**Не змінювалось:** сам `marketSyncHandler` і воркер `data-sync-market` (`concurrency: 10` у
`app/worker/worker.ts` лишається реальним обмежувачем паралелізму). Розклад задається в коді
(`MARKET_SYNC_CRON_PATTERN`) і зберігається в Redis через BullMQ `upsertJobScheduler`.

**Граничні випадки:** бюджет ≤ 0 → нічого не ставимо; застряглий `IN_PROGRESS` (>5 год) → не
рахується, магазин знову кандидат; магазин без логів → найвищий пріоритет; магазин без
offline-токена/`apiKey` → тихо пропускається (слот бюджету не використовується).

---

## Виправлено

| Проблема | Файл |
|----------|------|
| Market URL: додано `/products/` + `?variant=<id>` (узгоджено bulk/market/webhook) | `resolve-market-urls.ts`, `append-variant-param.ts`, `create-product-variant-payload.ts`, `create-product-variant-payload-from-webhook.ts` |
| DELETE URL `/api/v1/v1/products` | `app/api/delete-product-variants.ts` |
| Translations у вебхуках | `create/update-product-variant.server.ts`, `create-product-variant-payload-from-webhook.ts` |
| removedLocales у вебхуках | `update-product-variant.server.ts` |
| Market sync у вебхуках (contextualPricing) | `app/services/update-market-from-webhook.server.ts` |
| Видалені маркети у вебхуках | `update-market-from-webhook.server.ts` + `MarketSyncRepositoryImpl.deleteManyByKeys` |
| Пагінація варіантів у contextual pricing | `get-product-contextual-pricing.ts` |
| Translation categories (#8) | `get-product-translations.ts` |
| DELETE orphan variants у вебхуку (#13) | `update-product-variant.server.ts` |
