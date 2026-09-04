# Budgree Architecture

**Verified against:** `main` at `d349cf1b21acebcf438afe4c9f50688e5cdade41`

**Verification date:** 2026-09-04

This document describes code that exists in the repository. Planned work belongs in `ROADMAP.md`; current blockers and validation results belong in `CURRENT_STATUS.md`.

## Repository structure

```text
apps/mobile       Expo and React Native product
apps/web          Next.js app and finance API routes
packages/shared   Shared data, state, i18n and domain utilities
supabase/functions
                  Server-side Gemini integration
supabase/migrations
                  Incremental hosted-database changes
```

The repository uses npm workspaces and one root `package-lock.json`. CI runs the root `verify` script on pushes to `main` and on pull requests.

## Mobile runtime

The mobile application uses Expo Router. The root layout installs the theme, auth and TanStack Query providers, then protects the authenticated and unauthenticated route groups.

```text
Root layout
  ThemeProvider
    AuthProvider
      QueryProvider
        unauthenticated -> (auth)
        authenticated   -> (tabs), profile
```

The authenticated tabs are Dashboard, Analytics and Transactions. Transaction creation and editing are presented through the shared transaction modal.

## Authentication and user isolation

Supabase Auth supports email/password sign-up, sign-in, sign-out, session restoration, password recovery and protected routes. Sessions are persisted in React Native AsyncStorage.

The `transactions`, `assets` and `categories` migrations add `user_id` ownership and authenticated-role RLS policies for select, insert, update and delete. Transaction writes also prove that source account, destination account and category belong to the same authenticated user. Profiles use owner-scoped RLS. TanStack Query cache is cleared whenever the authenticated user changes so one account cannot see another account's cached data.

The hosted core DDL was captured from `information_schema`/`pg_catalog` metadata as the first migration. Every migration now has a unique chronological version, a deterministic non-personal seed is tracked, and CI rebuilds a fresh local Supabase database before running two-user RLS tests.

## State and data access

- TanStack Query owns remote/server state and mutation invalidation.
- Zustand owns authentication projection, theme preference and small client-only UI state.
- Shared Supabase API modules own CRUD queries.
- Query keys are shared centrally.
- Transactions retain the original currency and a fixed exchange rate into the current EUR base currency.
- Transfers move value between a source and destination account without becoming income or expense.

The current implementation fetches the full transaction ledger and calculates balances in the client. Pagination and server-side aggregates are future scaling work.

## AI boundary

Text, voice and receipt inputs call the JWT-protected `ask-gemini` Supabase Edge Function. Gemini credentials and prompts live server-side; no Gemini key belongs in the mobile bundle. The function supports transaction parsing, category suggestions and receipt scanning with model fallback and request timeouts.

An authenticated database function atomically enforces a short AI burst limit and a monthly allowance per user. The Edge Function also rejects oversized HTTP bodies, text, category/account lists, audio and receipt images before contacting Gemini. Quota counters are not directly readable or writable by API roles.

The hosted database migration history is aligned with the repository, both security migrations are deployed, and hosted `ask-gemini` version 11 runs with JWT verification enabled.

## Internationalization and theming

The shared i18n package includes English, Turkish, Dutch and Spanish with English fallback. UI language currently follows the device language. Number formatting also considers the device region.

Mobile supports light, dark and automatic appearance through semantic color tokens. Theme preference is persisted with Zustand and AsyncStorage. The web workspace has not yet adopted the mobile product design system.

## Web boundary

The Next.js workspace currently provides:

- a compilable application shell;
- Yahoo Finance search and quote proxy routes;
- TanStack Query and Zustand providers.

The visible page is still the Create Next App template. Finance routes validate the caller's Supabase access token, consume separate per-user search/quote quotas and reject oversized or malformed query parameters before contacting Yahoo.

## Testing and delivery

Unit tests cover money input/formatting, credit-card billing months, account-card appearance and finance-route authentication/throttling behavior. The root quality gate runs:

1. web ESLint;
2. mobile, shared and web TypeScript checks;
3. shared and web unit tests;
4. the Next.js production build.

Missing production gates include mobile component/integration tests, end-to-end tests, EAS profiles and deployment configuration. Database rebuild and cross-user RLS tests run in CI.
