# Yespo Shopify App

Shopify app for integration Yespo with Shopify

## Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo
- Automatically register their store domain in Yespo (to get site and web push scripts)
- Inject site and push scripts into the storefront via Theme App Extensions
- Install the service worker file for web push notifications using a Shopify App Proxy


## Features and Implementation Details

### Widgets

Purpose: Register the store domain and inject the Yespo site script into the storefront automatically.

Implementation:
- [Registers](https://docs.esputnik.com/reference/createdomain) the current store domain in Yespo
- [Retrieves](https://docs.esputnik.com/reference/getscript) the Yespo site script
- Stores the script content in a Shopify metafield: yespo-script
- Injects the script into the storefront using a Theme App Extension (./extensions/yespo-extension)

### Web Push Subscription

Purpose: Enable customer subscriptions to web push notifications by registering the domain and injecting required scripts.

Implementation:
- [Registers](https://docs.esputnik.com/reference/addwebpushdomain) the current store domain in Yespo
- [Retrieves](https://docs.esputnik.com/reference/getscript) the push script and service worker content
- Stores the push script in the yespo-web-push-script metafield
- Injects the push script into the storefront using the same Theme App Extension

Service Worker Installation:
- A Shopify App Proxy is used to serve the service worker content dynamically from Yespo
- The worker file is exposed at a predefined path (/apps/yespo/sw.js) to comply with browser requirements

### Contact Sync (Shopify → Yespo)
Purpose: Automatically sync new, updated, and deleted customers from Shopify to Yespo as contacts.

Implementation:
- App requests access to the following scopes:
  - read_customers
  - write_customers
- Shopify webhooks used:
  - customers/create → creates a new contact in Yespo
  - customers/update → updates existing contact data
  - customers/redact → removes contact in Yespo

Deduplication in Yespo: Contacts are matched using externalCustomerId, email, and phone. If a contact exists, it is updated instead of duplicated.

Yespo API methods:
- [POST /contact](https://docs.esputnik.com/reference/addcontact-1) – create or update contact
- [DELETE /contact](https://docs.esputnik.com/reference/deletecontact-1) (erase=true) – remove contact


## Technologies and Shopify Tools Used

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) - Theme app extensions allow the Yespo app to 
seamlessly inject scripts into a merchant’s theme without manual code edits.
  You can find the extension code in the `./extension/yespo-extension` directory.
  This extension includes:
  - `blocks/` – Contains Liquid files that act as entry points for injecting Yespo scripts into the theme. These blocks can be enabled via the Shopify theme editor.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences
- [Webhooks](https://shopify.dev/docs/api/webhooks?reference=toml) - to listen for customer-related changes
- [Metafields](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces) - 
used for storing tracking and scripts configurations (custom namespace: $app)

## Yespo API Authentication

The app uses a Yespo API key, provided by the merchant during onboarding, to authorize all API requests. The key is stored securely and used for:
- Contact sync
- Domain registration
- Script retrieval

Full API documentation: https://docs.yespo.io/docs/integration-with-api


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
Use the next command to deploy your app with Shopify CLI.
```shell
npm run deploy
```


### Using the App

- Install the app in your Shopify store
- [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it to the `Account connection` section
- Connect general script
- Connect webpush script
