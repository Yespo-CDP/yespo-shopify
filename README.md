# Yespo App

Shopify app for integration Yespo with Shopify

### Setup

#### Env

| Name                      | Description                                           | Example                                           |
| ------------------------- | ------------------------------------------------------| ------------------------------------------------- |
| **SHOPIFY_API_KEY**       | **Required.** Your shopify app Client ID              | `12e4a9a4*****************eb80fba`                |
| **SHOPIFY_API_SECRET**    | **Required.** Your shopify app Client secret          | `f7725*********************420ad06`               |
| **SHOPIFY_APP_URL**       | **Required.** Your shopify app url                    | `https://your-domain.com`                         |
| **SHOPIFY_YESPO_EXTENSION_ID** | **Required.** Extension ID (Auto generated after run `deploy` command) | `c10***ff-****-48cc-****-f882b***fa8e` |
| **DATABASE_URL**          | **Required.** Database connect url                    | `postgresql://admin:admin@localhost:5432/database`|
| **SCOPES**                | **Required.** Required access scopes                  | **Must be** `read_markets,read_themes`            |
| **API_URL**               | **Required.** Yespo api url                           | **Must be** `https://yespo.io/api/v1`             |
| **GENERAL_SCRIPT_HANDLE** | **Required.** Handle for general metafield and extension name | **Must be** `yespo-script`                |
| **WEB_PUSH_SCRIPT_HANDLE**| **Required.** Handle for webpush metafield and extension name | **Must be** `yespo-web-push-script`       |
| **DOCK_URL**              | Yespo dock link                                        |`https://docs.yespo.io`                           |
| **PLATFORM_URL**          | Yespo platform link                                    |`https://my.yespo.io`                             |

#### Setup App Proxy

- Select yespo app in shopify partner
- Go to `Configuration`
- Find `App proxy` section
- Subpath prefix: `apps`
- Subpath: `yespo-proxy`
- Proxy URL: `https://push.yespo.tech/`


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
   git clone https://github.com/YOUR_USERNAME/yespo-shopify.git
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

Instead, please email us directly at: **security@yespo.io**

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



### 🎉 Recognition

Contributors are recognized in:
- 📜 Release notes for significant contributions
- 🌟 GitHub contributors section
- 💬 Social media mentions for major features

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
- **🔒 Security issues** → security@yespo.io (private)

---

Thank you for contributing to Yespo Shopify App! 🙏

Your contributions help make Yespo better for everyone. Whether you're reporting bugs, suggesting features, or contributing code, every bit helps! 💙
