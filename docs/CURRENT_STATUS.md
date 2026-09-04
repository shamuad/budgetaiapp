# Current Status

**Product stage:** authenticated mobile alpha

**Code snapshot reviewed:** `feat/api-abuse-protection`, based on `main` at `318e52f3cbdf2377b65728af6844d8221eeb8207`

**Last reviewed:** 2026-09-04

## Implemented and evidenced in code

- Expo Router authentication and protected navigation
- Supabase email/password login, sign-up, sign-out and password recovery
- Owner-scoped RLS migrations for financial data and profiles
- Reproducible Supabase core schema, deterministic local seed and versioned local configuration
- Two-user database tests for CRUD isolation and cross-tenant relationship rejection
- Account, category and transaction CRUD
- Transfers, investment holdings, installments and credit-card billing periods
- Dashboard and analytics views
- TanStack Query server state and Zustand client state
- Query-cache clearing when the authenticated user changes
- English, Turkish, Dutch and Spanish translations
- Light, dark and automatic mobile themes
- Server-side Gemini text, voice, categorization and receipt/Vision flows
- Per-user Gemini quotas plus request, media and collection-size limits
- Authenticated, per-user rate-limited Yahoo Finance search and quote proxy routes

## Verification

- Expo Doctor: 21/21 checks pass
- Mobile TypeScript: passes
- Shared/web unit tests: 41/41 pass when run with the configured TypeScript test runner
- Web ESLint: passes
- Web production build: passes

The root `npm run verify` command and CI workflow are the canonical repeatable checks.
The database CI job additionally rebuilds Supabase from zero and runs the pgTAP schema/RLS suites.

## Production blockers

1. The new quota migration and updated Gemini Edge Function still need a controlled hosted Supabase rollout.
2. EAS/Vercel environment and release configuration is absent.
3. Privacy, account deletion/export and operational monitoring are absent.

## Technical debt to control

- `AddTransactionModal` and several management/analytics components are too large.
- The full ledger is fetched and aggregated on the client.
- The user base currency remains fixed to EUR.
- The visible web page is still a framework starter.
