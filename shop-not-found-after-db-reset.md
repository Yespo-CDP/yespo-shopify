# Чому після reset БД з’являється `Shop not found`

## Що зламалось

Після `npx prisma migrate reset` апка відкривається, API key виглядає валідним, але Connect показує:

`AccountConnectionSection.errors.Shop not found`

Це не помилка Yespo і не невалідний ключ. У `app/lib/app.server.ts` текст помилки береться як `error.message` і підставляється в ключ перекладу. Реальний exception — `Shop not found` з `shopRepository.updateShop`.

## Чому так сталося

Рядок магазину в Postgres створюється лише в хуку `afterAuth` (`app/services/afterAuth.server.ts`): `createShop` з `shopUrl = myshopifyDomain`.

Після локального reset відбуваються дві різні речі:

1. Prisma стирає і `Session`, і `Shop`.
2. Shopify managed install / token exchange знову створює offline-сесію (`offline_<shop>.myshopify.com`) при відкритті апки.

Хук `afterAuth` при такому повторному вході часто **не викликається**. Сесія є — апка відкривається. Рядка `Shop` немає.

Перевірка на зламаному стані:

- `Session`: є запис `yespo-dev-store-2.myshopify.com`
- `Shop`: порожньо

Далі Connect робить `updateShop(session.shop, { apiKey, orgId })`. `updateShop` шукає рядок і кидає `Shop not found`, якщо його немає.

Uninstall / reinstall / `shopify app deploy` це не лікують: проблема не в скоупах і не в Partner Dashboard, а в тому, що наш рядок `Shop` більше ніхто не створює.

## Чому фікс саме такий

Не додавався окремий шлях створення shop і не дублювалась логіка metafields/webhooks. Якщо рядка немає — ще раз викликається той самий `afterAuth`, який і так відповідає за перше налаштування магазину.

Це зроблено в двох місцях:

- **loader** головної сторінки (`app/lib/app.server.ts`) — щоб shop з’явився вже при відкритті апки, до Connect;
- **connect account** (`app/services/connect-account.server.ts`) — страховка, якщо користувач натисне Connect до того, як loader встиг створити рядок.

Інші варіанти гірші:

- покладатись лише на хук Shopify — після reset знову те саме;
- руками вставляти рядок у БД — не відновить metafields і webhooks;
- просити uninstall апки — при token exchange `afterAuth` знову може не спрацювати.

## Як перевірити

1. `npm run dev` має підхопити зміни (окремий deploy не потрібен).
2. Оновити сторінку апки в адмінці.
3. Ще раз ввести API key і натиснути Connect.

Після цього в таблиці `Shop` має з’явитись рядок з `shopUrl` магазину.
