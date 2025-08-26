# Yespo Shopify App

Shopify app for integration Yespo with Shopify

## Purpose
The app allows merchants to:
- Sync customer data (create, update, delete) from Shopify to Yespo
- Automatically register their store domain in Yespo (to get site and web push scripts)
- Inject site and push scripts into the storefront via Theme App Extensions
- Install the service worker file for web push notifications using a Shopify App Proxy
- Send tracking events like MainPage, 404 Page, ProductPage, CustomerData, StatusCart and PurchasedItems from your store to Yespo


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

Enable contacts sync (optional):
- Open yespo app
- Connect your yespo account
- Enable sync in `Contact Sync` section

Deduplication in Yespo: Contacts are matched using externalCustomerId, email, and phone. If a contact exists, it is updated instead of duplicated.

Yespo API methods:
- [POST /contact](https://docs.esputnik.com/reference/addcontact-1) – create or update contact
- [DELETE /contact](https://docs.esputnik.com/reference/deletecontact-1) (erase=true) – remove contact

### Web Tracker
Purpose: Allow you to track events within your site.

Implementation:
- Stores the enable flag in the web-tracking-enabled metafield
- Send tracking events from the site to Yespo through Theme extension.

#### Frontend Events
- **MainPage** - [MainPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#main-page) occurs when user visited Home page of the site
- **404 Page** - [404 Page event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#404-page) occurs when user visited 404 page of the site
- **Status Cart Page** - [StatusCartPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#additional-events-required-for-recommendations-on-the-site) occurs when user visited /cart page of the site
- **Category Page** - [StatusCartPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#category) occurs when user visited category page of the site
- **ProductPage** - [ProductPage event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#product-card) occurs when user visited product page of the site and send payload with product data:
  - productKey - product id
  - price - product price
  - isInStock - indicates if product is in stock
- **CustomerData** - [CustomerData event](https://docs.yespo.io/docs/how-set-web-tracking-sending-events-java-scipt-request#customer) occurs when there is a logged in user on the site and send payload with customer data:
  - externalCustomerId - customer id
  - user_email - customer email
  - user_name - customer name
  - phone - customer phone

#### Backend Events
- **StatusCart** - [StatusCart event](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#statuscart) 
occurs when CARTS_UPDATE webhook happened and send payload with cart data.
- **PurchasedItems** - [PurchasedItems](https://docs.yespo.io/docs/how-transfer-website-behavior-data-through-rest-api#purchaseditems)
occurs when ORDERS_CREATE webhook happened and send payload with purchased products data.


## Technologies and Shopify Tools Used

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [App extensions](https://shopify.dev/docs/apps/build/app-extensions) - Theme app extensions allow the Yespo app to 
seamlessly inject scripts into a merchant’s theme without manual code edits.
  You can find the extension code in the `./extensions/yespo-extension` directory.
  This extension includes:
  - `blocks/` – Contains Liquid files that act as entry points for injecting Yespo scripts into the theme. These blocks can be enabled via the Shopify theme editor.
  - `assests/` - Contains JavaScript script that send events using eS.JS.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences
- [Webhooks](https://shopify.dev/docs/api/webhooks?reference=toml) - to receive notifications about particular events in a shop such as customer-related changes.
- [Metafields](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#metafield-namespaces) - 
used for storing tracking and scripts configurations (custom namespace: $app)
- [Yespo Dock](https://docs.yespo.io/docs/integration-with-api) – Yespo API documentation.

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
| **HOST_URL**                   | **Required.** App host url metafiedld name for correct work of extension                                | **Must be** `yespo-app-host`                       |


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
| **carts/update**           | Triggered when a cart is updated in the online store.                         | `/webhooks/app/carts`         |


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

After deploying your app backend, you need to deploy the Shopify theme extension and app configuration (shopify.app.toml).
Use the Shopify CLI to deploy both:
```shell
npm run deploy
```
This command will:
- Deploy the Theme App Extension
- Sync the .toml configuration file to Shopify
- Link and register app blocks automatically

Make sure you're authenticated via Shopify CLI and connected to the correct Partner organization and store.

### Using the App

- Install the app in your Shopify store
- [Generate an API key](https://docs.yespo.io/reference/api-keys) and add it to the `Account connection` section
- Connect general script
- Connect webpush script
- Enable/disable web tracker on your site

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
└── routes/             # Remix routes
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
