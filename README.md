# Budgree

Budgree is a personal-finance product built as an npm-workspaces monorepo. The mobile app is the primary product; the web workspace currently provides a Next.js foundation and finance-data proxy routes.

## Current status

The mobile application is an authenticated alpha. It includes account, category and transaction management; transfers and investment holdings; installments and credit-card billing periods; analytics; light/dark/automatic themes; and Gemini-assisted text, voice and receipt entry.

It is not production-ready yet. The database can be rebuilt from versioned migrations, tenant isolation is covered by two-user RLS tests, and AI/finance entry points have authenticated per-user limits. Release configuration, hosted rollout and privacy operations remain incomplete. See [Current Status](docs/CURRENT_STATUS.md) and [Roadmap](docs/ROADMAP.md).

## Workspaces

- `apps/mobile` — Expo / React Native application
- `apps/web` — Next.js application and finance API routes
- `packages/shared` — shared Supabase APIs, TanStack Query hooks, Zustand stores, types, i18n and finance utilities
- `supabase/functions` — server-side Gemini integration
- `supabase/migrations` — incremental database migrations

## Local setup

Requirements:

- Node.js 22
- npm
- Docker Desktop or another Docker-compatible container runtime for local Supabase
- iOS Simulator/Xcode or Android development tooling for native runs

Install dependencies from the repository root:

```sh
npm ci
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and provide the public Supabase URL and anon key. Copy `apps/web/.env.example` to `apps/web/.env.local` so the server-side finance routes can validate Supabase sessions. The Gemini key must remain a Supabase secret and must never be placed in an `EXPO_PUBLIC_*` variable.

Run the applications:

```sh
npm run start --workspace=mobile
npm run dev --workspace=web
```

## Quality checks

Run the same quality gate used by CI:

```sh
npm run verify
```

This runs web linting, TypeScript checks for all workspaces, shared/web unit tests and the web production build.

Rebuild and test the local database:

```sh
npm run db:start
npm run verify:db
```

`verify:db` applies every migration to a clean database, loads deterministic development data and runs the schema/RLS pgTAP suites. It never connects to the hosted project.

## Documentation

- [Architecture](docs/PROJECT_STATE_AND_ARCHITECTURE.md)
- [Current Status](docs/CURRENT_STATUS.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)
