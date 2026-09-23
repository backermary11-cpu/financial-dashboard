# Financial Dashboard

A dashboard for personal and business finances: income, expenses, budgets and investments. It runs entirely in the browser. There is no server, and data is saved in the browser's `localStorage`.

## Features

- **Personal and Business ledgers.** A toggle at the top switches between them. Each has its own transactions and budgets.
- **Dashboard.**
  - Income, expenses, net cash flow, and savings rate (or profit margin for the Business ledger).
  - Monthly income vs. expenses chart, with a table view.
  - Spending by category.
  - Cumulative net cash flow over time.
  - Budget status for the current month.
  - Date range of 3, 6 or 12 months.
- **Transactions.**
  - Add, search, filter and delete.
  - **Import CSV** from your bank, with columns `date, description, category, amount` or `debit`/`credit`.
  - **Export CSV.**
- **Budgets.** A monthly limit per category, with On track, Near limit (80% or more) and Over budget states. Browse past months.
- **Investments.**
  - Holdings with shares, average cost and current price.
  - Value, unrealised gain and allocation.
  - Prices are entered by hand.
- **Backup and restore** of all data as a JSON file, plus buttons to load sample data or clear everything.
- Light and dark themes, and a mobile-friendly layout.

The app starts with generated sample data. Use **Clear all data** in the footer to start fresh. `sample-transactions.csv` shows the import format.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # type-check and production build to dist/
```

Stack: React 19, TypeScript, Vite, Recharts, PapaParse and Vitest.

```
src/
  lib/finance.ts        # pure calculations: totals, monthly series, budgets, portfolio, CSV
  lib/finance.test.ts   # unit tests
  lib/sampleData.ts     # deterministic demo data
  lib/storage.ts        # localStorage persistence
  components/           # Dashboard, Transactions, Budgets, Investments, shared UI
```

## Deploying

`dist/` is a static site.

- **Vercel:** import the repo. `vercel.json` sets the build settings.
- **Netlify:** import the repo. `netlify.toml` sets the build settings.
- **GitHub Pages or any static host:** run `npm run build` and upload `dist/`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and the build on every push.

## Not included yet

- Data stays in one browser and doesn't sync across devices. Adding that needs a backend and database, for example Supabase or a small Node API with Postgres.
- No live bank connection. That needs a provider such as Plaid and API keys.
- No live stock prices. That needs a market-data API key.
