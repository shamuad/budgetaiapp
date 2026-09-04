# Budgree

Budgree is a personal-finance product built as an npm-workspaces monorepo. The mobile app is the primary product; the web workspace currently provides a Next.js foundation and finance-data proxy routes.

## Current status

The mobile application is an authenticated alpha. It includes account, category and transaction management; transfers and investment holdings; installments and credit-card billing periods; analytics; light/dark/automatic themes; and Gemini-assisted text, voice and receipt entry.

It is not production-ready yet. The hosted Supabase base schema must be captured in a reproducible baseline migration, and RLS/Edge Function security still needs automated integration coverage. See [Current Status](docs/CURRENT_STATUS.md) and [Roadmap](docs/ROADMAP.md).

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
- iOS Simulator/Xcode or Android development tooling for native runs

Install dependencies from the repository root:

```sh
npm ci
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and provide the public Supabase URL and anon key. The Gemini key must remain a Supabase secret and must never be placed in an `EXPO_PUBLIC_*` variable.

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

This runs web linting, TypeScript checks for all workspaces, shared unit tests and the web production build.

## Documentation

- [Architecture](docs/PROJECT_STATE_AND_ARCHITECTURE.md)
- [Current Status](docs/CURRENT_STATUS.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)

