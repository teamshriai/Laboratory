# LIMS Client

Frontend for the hospital Laboratory Management System.

## Stack

- React 19 + TypeScript 6 (strict), built with Vite 8
- Tailwind CSS v4 through `@tailwindcss/vite` (CSS-first config in `src/styles/index.css`, no `tailwind.config.js`)
- React Router 7 for routing
- TanStack Query 5 for server state, axios for HTTP
- ESLint (type-aware) + Prettier (with Tailwind class sorting)
- Vitest + Testing Library + jsdom

## Getting started

Requires Node `^20.19.0 || >=22.12.0`.

```sh
npm install
cp .env.example .env.local   # optional, defaults work out of the box
npm run dev                  # http://localhost:5173
```

## Scripts

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server with HMR                |
| `npm run build`     | Type-check, then build to `dist/`            |
| `npm run preview`   | Serve the production build locally           |
| `npm run typecheck` | Run the TypeScript compiler (no emit)        |
| `npm run lint`      | Lint with ESLint (`lint:fix` to auto-fix)    |
| `npm run format`    | Format with Prettier (`format:check` for CI) |
| `npm test`          | Run Vitest in watch mode                     |
| `npm run test:run`  | Run the test suite once                      |
| `npm run coverage`  | Run tests with V8 coverage                   |

## Environment

| Variable                | Default                 | Purpose                                            |
| ----------------------- | ----------------------- | -------------------------------------------------- |
| `VITE_API_BASE_URL`     | `/api`                  | Base URL for `apiClient` (`src/lib/api-client.ts`) |
| `VITE_API_PROXY_TARGET` | `http://localhost:4000` | Where the dev server forwards `/api` requests      |

In development, requests to `/api/*` are proxied to the Node backend in `../server`, so no CORS setup is needed locally.

## Folder conventions

```
src/
  app/          App shell: providers, query client, routes, layouts
  pages/        Route-level components
  features/     Domain modules, created as they are built, for example:
    patients/     registration, search, history
    test-orders/  ordering tests and panels
    samples/      collection, accessioning, tracking
    results/      entry, validation, approval
    reports/      printable reports, turnaround analytics
  components/   Shared UI components
  hooks/        Shared hooks
  lib/          Framework-agnostic helpers (API client, env)
  styles/       Global CSS and Tailwind theme
  test/         Test setup
```

Each feature folder owns its API calls (TanStack Query hooks built on `apiClient`), components and types. Import across the app with the `@/` alias, which maps to `src/`.
