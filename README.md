# Yespo App

Shopify app for integration Yespo with Shopify

### Setup

#### Env

| Name                      | Description                                           | Example                                           |
| ------------------------- | ------------------------------------------------------| ------------------------------------------------- |
| **SHOPIFY_API_KEY**       | **Required.** Your shopify app Client ID              | `12e4a9a4*****************eb80fba`                |
| **SHOPIFY_API_SECRET**    | **Required.** Your shopify app Client secret          | `f7725*********************420ad06`               |
| **SHOPIFY_APP_URL**       | **Required.** Your shopify app url                    | `https://your-domain.com`                         |
| **SHOPIFY_YESPO_EXTENSION_ID**    | **Required.** Extension ID (Auto generated after run `deploy` command) | `c10***ff-****-48cc-****-f882b***fa8e` |
| **DATABASE_URL**          | **Required.** Database connect url                    | `postgresql://admin:admin@localhost:5432/database`|
| **SCOPES**                | **Required.** Required access scopes                  | **Must be** `read_markets,read_themes`            |
| **API_URL**               | **Required.** Yespo api url                           | **Must be** `https://yespo.io/api/v1`             |
| **GENERAL_SCRIPT_HANDLE** | **Required.** Handle for general metafield and extension name | **Must be** `yespo-script`                |
| **WEB_PUSH_SCRIPT_HANDLE**| **Required.** Handle for webpush metafield and extension name | **Must be** `yespo-web-push-script`       |

#### Install dependencies
```shell
npm install
```

#### Database development & migration
dev
```shell
npx prisma generate
npx prisma migrate dev
```
prod
```shell
npm run setup
```

#### Build

```shell
npm run build
```

### Using

- Install app in your shop
- [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it to the `Account connection` section
- Connect general script
- Connect webpush script
- Enable yespo extension in your shop theme config

#### Shopify deployment
Shopify CLI required
Set up your `shopify.app.toml` config file, and deploy the config to shopify using this command
```shell
npm run deploy
```

#### Local Development Run
Shopify CLI required
```shell
npm run dev
```

#### Production Run

```shell
npm run start
```

## Tech Stack

This template uses [Remix](https://remix.run). The following Shopify tools are also included to ease app development:

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) an app extension enables you to add your app's functionality to Shopify user interfaces.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences
- [Yespo Dock](https://docs.yespo.io/docs/integration-with-api): Yespo API documentation
