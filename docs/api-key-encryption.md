# Yespo API key encryption

`Shop.apiKey` is encrypted at rest with AES-256-GCM. New writes encrypt the key automatically. Rows that already exist stay plaintext until the one-time script below runs.

Encrypt existing keys on staging and confirm Yespo still accepts them **before deploying this release to production**.

## What is stored

| Column | Contents |
|---|---|
| `apiKey` | Ciphertext, base64. Empty string and `null` are stored as-is. |
| `apiKeyIv` | 12-byte IV, base64. `null` on plaintext, empty, and `null` keys. |
| `apiKeyAuthTag` | GCM auth tag, base64. `null` together with `apiKeyIv` means the row is still plaintext. |

Both new columns are added by `prisma/migrations/20261007131600_add_shop_api_key_encryption`.

## Key

`API_KEY_ENCRYPTION_KEY` is the AES-256 key: 32 bytes, base64.

```shell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it on each environment separately (local `.env`, staging Heroku, production Heroku). Generate it once per environment and do not change it after any key has been encrypted. A different value cannot decrypt existing rows.

The app reads plaintext rows when `apiKeyIv` and `apiKeyAuthTag` are both `null`, so a deploy does not break shops that have not been backfilled yet. After the backfill, the app and the script must use the same key.

## Read and write path

`app/services/api-key-crypto.server.ts`

- `sealShopApiKeyWrite` encrypts `apiKey` on create and update. Writes that do not include `apiKey` leave the stored key untouched.
- `revealShopApiKey` decrypts on read. A failed auth tag throws `Failed to decrypt apiKey` and does not return the ciphertext.

`ShopRepositoryImpl` applies both helpers, so callers keep working with the plaintext Yespo key.

## One-time backfill

`npm run encrypt:api-keys` runs `app/scripts/encrypt-api-keys.ts`.

It selects every shop where `apiKey` is non-empty and both `apiKeyIv` and `apiKeyAuthTag` are `null`, then encrypts those keys. The update is conditional on those columns still being `null`, so a second run skips rows that are already encrypted.

The script needs `DATABASE_URL` and `API_KEY_ENCRYPTION_KEY`. Run it on the Heroku app so it uses that app's config:

```shell
brew install heroku/brew/heroku   # once, if the CLI is missing
heroku login                       # local terminal; opens a browser
heroku run npm run encrypt:api-keys -a <heroku-app-name>
```

`<heroku-app-name>` is the app slug, not the `*.herokuapp.com` hostname. Staging is `yespo-app-staging`. The script has to be in the deployed slug; `heroku run` cannot see uncommitted local files.

Expect `encrypted <shopUrl>` for each updated row and `done: encrypted N, skipped M`.

## Before production deploy

Do not deploy this release to production until existing API keys are encrypted and checked.

1. Set `API_KEY_ENCRYPTION_KEY` on the staging app.
2. Deploy to staging so the migration and `encrypt:api-keys` are on the dyno.
3. Run `heroku run npm run encrypt:api-keys -a yespo-app-staging`. The script encrypts every shop that still has a plaintext key.
4. Confirm shops can still call Yespo (account info, sync).
5. Repeat the same steps on production: set a **new** production `API_KEY_ENCRYPTION_KEY` before the production deploy, deploy, then run `heroku run npm run encrypt:api-keys -a <production-app>` before treating the release as done.

Leave the production key in place; replacing it makes every stored key unreadable.
