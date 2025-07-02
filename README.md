# Yespo App

Shopify app for integration Yespo with Shopify

## 🚀 Features
- Automatically injects Yespo General Script on all store pages
- Installs Yespo Web Push Script and adds the Service Worker file
- Enables Web Tracking to personalize user experience
- Transfer of creation, update, deletion of contacts
- Sends tracking events like MainPage, 404 Page, ProductPage from your store to Yespo


## Quick start

### Prerequisites

Before you begin, you'll need the following:

1. **Node.js**: version 20 [Download and install](https://nodejs.org/en/download/) it if you haven't already.
2. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup) if you don't have one.
3. **Test Store**: Set up either a [development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or a [Shopify Plus sandbox store](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store) for testing your app.

### Setup

#### Environment variables

Create a `.env` file with the following:

| Name                      | Description                                                                                             | Example                                          |
| ------------------------- |---------------------------------------------------------------------------------------------------------| ------------------------------------------------ |
| **SHOPIFY_API_KEY**       | **Required.** Your shopify app Client ID                                                                | `12e4a9a4*****************eb80fba`               |
| **SHOPIFY_API_SECRET**    | **Required.** Your shopify app Client secret                                                            | `f7725*********************420ad06`              |
| **SHOPIFY_APP_URL**       | **Required.** Your shopify app url                                                                      | `https://your-domain.com`                        |
| **SHOPIFY_YESPO_EXTENSION_ID** | **Required.** Extension ID (Auto generated after run `deploy` command)                                  | `c10***ff-****-48cc-****-f882b***fa8e` |
| **DATABASE_URL**          | **Required.** Database connect url                                                                      | `postgresql://admin:admin@localhost:5432/database`|
| **SCOPES**                | **Required.** Required access scopes                                                                    | **Must be** `read_markets,read_themes`           |
| **API_URL**               | **Required.** Yespo api url                                                                             | **Must be** `https://yespo.io/api/v1`            |
| **GENERAL_SCRIPT_HANDLE** | **Required.** Handle for general metafield and extension name                                           | **Must be** `yespo-script`               |
| **WEB_PUSH_SCRIPT_HANDLE**| **Required.** Handle for webpush metafield and extension name                                           | **Must be** `yespo-web-push-script`      |
| **DOCK_URL**              | Yespo dock link                                                                                         |`https://docs.yespo.io`                          |
| **PLATFORM_URL**          | Yespo platform link                                                                                     |`https://my.yespo.io`                            |
| **SERVICE_WORKER_NAME**   | **Required.** Web push service worker file name, in *.js format                                         | **Must be** `service-worker.js`                  |
| **SERVICE_WORKER_PATH**   | **Required.** Relative path on site, where service worker will be stored. Must start and end with slash | `/apps/yespo-proxy/`|
| **WEB_TRACKING_ENABLED**   | **Required.** Handle for enabled metafield and extension name                                           | **Must be** `web-tracking-enabled`                         |


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
- `read_themes`
- `write_app_proxy`

#### Webhooks
Shopify webhooks (API version: 2025-01) used by the app:

| Event Topic                | Description                                                                   | Endpoint                              |
|----------------------------|-------------------------------------------------------------------------------|---------------------------------------|
| **customers/data_request** | Triggered when a customer requests their personal data under GDPR compliance. | `/webhooks/app/gdpr`                  |
| **customers/redact**       | Triggered when a customer requests deletion of their personal data (GDPR).    | `/webhooks/app/gdpr`                  |
| **shop/redact**            | Triggered when a store uninstalls the app and requests data erasure.          | `/webhooks/app/gdpr`                  |
| **carts/update**           | Triggered whenever a customer updates a cart (e.g. adding/removing items).    | `/webhooks/app/carts`                 |
| **customers/create**       | Triggered when a new customer account is created in the store.                | `/webhooks/app/customers`             |
| **customers/update**       | Triggered when an existing customer’s data is updated.                        | `/webhooks/app/customers`             |
| **app/scopes_update**      | Triggered when the app's permission scopes are updated by the merchant.       | `/webhooks/app/scopes_update`         |
| **app/uninstalled**        | Triggered when a merchant uninstalls the app.                                 | `/webhooks/app/uninstalled`           |



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
#### Hosting and source code deployment

Firstly you need to deploy source code to hosting. We provide example of hosting to Heroku with using [Procfile](https://devcenter.heroku.com/articles/procfile).
1. Create a Heroku App
```shell
heroku login
heroku create your-app-name
```
2. [Set Environment Variables](https://devcenter.heroku.com/articles/config-vars) on Heroku
3. Set up [Postgres](https://devcenter.heroku.com/articles/heroku-postgresql). We recommend to use plan with Storage Capacity at least 10 GB.
4. Add a Procfile if needed. Our repo already has Procfile.
4. Commit Changes and Push to Heroku
```shell
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

#### Deployment of Theme extension and .toml file
After deployment source code you need to deploy Theme extension and .toml file configuration.


#### Shopify App Deployment
1. Ensure your shopify.app.toml is configured
2. Deploy with:
```shell
npm run deploy
```

### Using the App

- Install the app in your Shopify store
- [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it to the `Account connection` section
- Connect general script
- Connect webpush script
- Enable yespo extension in your shop theme config


## Tech Stack

This template uses [Remix](https://remix.run). The following Shopify tools are also included to ease app development:

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) an app extension enables you to add your app's functionality to Shopify user interfaces.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences
- [Yespo Doc](https://docs.yespo.io/docs/integration-with-api): Yespo API documentation

## APIs and Tools Used 🛠️

### Metafields
Metafields allow you to store custom data for Shopify resources. In this app, we use metafields to manage script settings and enable tracking functionality.

The following metafields are used (within the $app namespace):
- `yespo-script` - Stores the configuration for the general Yespo script
- `yespo-web-push-script` - Stores the configuration for the Yespo web push script
- `web-tracking-enabled` - Flag to enable or disable Yespo web tracking in the theme

*for more information on Metafields*, [check out guide](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces)

### Theme App Extensions
Theme app extensions allow the Yespo app to seamlessly inject scripts into a merchant’s theme without manual code edits.

You can find the extension code in the `./extension/yespo-extension` directory.

This extension includes:
- `blocks/` – Contains Liquid files that act as entry points for injecting Yespo scripts into the theme. These blocks can be enabled via the Shopify theme editor.
- `assets/` – Contains JavaScript files that track and send specific page events (like 404 Page and Main Page) to Yespo for analytics and customer behavior tracking.

These extensions ensure scripts are added in a structured, upgrade-safe way and can be toggled directly from the store's theme settings.

### Yespo
This app uses the Yespo API to sync customer data, track events, and manage communication workflows.

The API allows the app to:
- Create, update, and delete contacts in Yespo based on Shopify customer data
- Send web tracking events (e.g. MainPage, ProductPage, 404 Page)
- Authenticate requests using a generated API key from your Yespo account

Refer to the official [Yespo API Documentation](https://docs.yespo.io/docs/integration-with-api) for detailed request/response formats and usage examples.
