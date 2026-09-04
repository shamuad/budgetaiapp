# Current Status

**Product stage:** authenticated mobile alpha

**Code snapshot reviewed:** `main` at `d349cf1b21acebcf438afe4c9f50688e5cdade41`

**Last reviewed:** 2026-09-04

## Implemented and evidenced in code

- Expo Router authentication and protected navigation
- Supabase email/password login, sign-up, sign-out and password recovery
- Local-Supabase integration coverage for sign-up/login/logout, password replacement, user switching and RLS-isolated account reads
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
- Shared/web unit tests: 45/45 pass when run with the configured TypeScript test runner
- Web ESLint: passes
- Web production build: passes

The root `npm run verify` command and CI workflow are the canonical repeatable checks.
The database CI job additionally rebuilds Supabase from zero, runs the auth lifecycle integration scenario and runs the pgTAP schema, RLS and quota suites.

The hosted Supabase migration history matches all 14 local migrations. The hardened schema and quota migration are deployed, and `ask-gemini` version 11 is active with JWT verification; live smoke tests return `200` for CORS preflight and `401` for an unauthenticated POST.

## Production blockers

1. EAS/Vercel environment and release configuration is absent.
2. Privacy, account deletion/export and operational monitoring are absent.

## Technical debt to control

- `AddTransactionModal` and several management/analytics components are too large.
- The full ledger is fetched and aggregated on the client.
- The user base currency remains fixed to EUR.
- The visible web page is still a framework starter.
