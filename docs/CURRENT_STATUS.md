# Current Status

**Product stage:** authenticated mobile alpha

**Code snapshot reviewed:** `main` at `bb0ad29851d29b7721f9d1888c7cecafbdc176b2`

**Last reviewed:** 2026-09-04

## Implemented and evidenced in code

- Expo Router authentication and protected navigation
- Supabase email/password login, sign-up, sign-out and password recovery
- Owner-scoped RLS migrations for financial data and profiles
- Account, category and transaction CRUD
- Transfers, investment holdings, installments and credit-card billing periods
- Dashboard and analytics views
- TanStack Query server state and Zustand client state
- Query-cache clearing when the authenticated user changes
- English, Turkish, Dutch and Spanish translations
- Light, dark and automatic mobile themes
- Server-side Gemini text, voice, categorization and receipt/Vision flows
- Yahoo Finance search and quote proxy routes in the web workspace

## Verification

- Expo Doctor: 21/21 checks pass
- Mobile TypeScript: passes
- Shared unit tests: 37/37 pass when run with the configured TypeScript test runner
- Web ESLint: passes
- Web production build: passes

The root `npm run verify` command and CI workflow are the canonical repeatable checks.

## Production blockers

1. The core Supabase base schema is not represented by a baseline migration.
2. RLS has no automated two-user integration test.
3. Edge Function JWT deployment behavior, quotas, rate limiting and payload limits are not fully version-controlled.
4. EAS/Vercel environment and release configuration is absent.
5. Privacy, account deletion/export and operational monitoring are absent.

## Technical debt to control

- `AddTransactionModal` and several management/analytics components are too large.
- The full ledger is fetched and aggregated on the client.
- The user base currency remains fixed to EUR.
- The visible web page is still a framework starter.
- Public finance proxy routes need abuse protection before deployment.
