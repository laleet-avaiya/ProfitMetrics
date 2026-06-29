# Profit Metrics

A SaaS platform for ecommerce sellers to track profit, loss, revenue, and expenses across sales platforms.

## Features

- 🔐 Firebase Authentication (Email/Password)
- 🏪 Multi-tenant company workspace (auto-created on signup)
- 📦 **Products** — SKUs with per-platform pricing (Amazon, Shopify, Noon, etc.)
- 🛒 **Sales** — Daily order logging with auto profit calculation
- 💸 **Expenses** — Business cost tracking
- 📊 **Dashboard & Reports** — P&L, margins by product/platform
- 🌓 Dark mode support

See [docs/PRODUCT.md](docs/PRODUCT.md) for the full product design.

## Firebase Setup

This project uses Firebase for authentication and Firestore for data storage.

### Environment variables

Copy `.env.example` to `.env` and fill in values from the Firebase console (Project settings → Your apps):

```bash
cp .env.example .env
```

Required `VITE_FIREBASE_*` variables are read at build time by Vite. For production deploys, set the same keys as GitHub Actions repository secrets (see `.github/workflows/deploy-common.yml`).

### Deploying Firestore Rules and Indexes

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Deploy Firestore Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Deploy Firestore Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

5. **Deploy Both Rules and Indexes**:
   ```bash
   firebase deploy --only firestore
   ```

### Firestore Security Rules

The security rules ensure that:
- Users can only access their own company data
- `products`, `sales`, and `expenses` are scoped by `companyId`
- Only authenticated users can read/write data
- Company ID must match the authenticated user's UID

Rules are defined in `firestore.rules`.

### Firestore Indexes

Composite indexes for `products`, `sales`, and `expenses` are defined in `firestore.indexes.json` (company-scoped lists, date-range reports, and breakdowns by product/platform/category).

Deploy indexes:

```bash
firebase deploy --only firestore:indexes
```

Or deploy rules and indexes together:

```bash
firebase deploy --only firestore
```

## Development

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
