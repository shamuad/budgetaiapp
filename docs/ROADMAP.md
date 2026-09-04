# Roadmap

The ordering below is a delivery constraint: later feature work must not bypass incomplete security and reproducibility gates.

## M0 — Foundation and security

### M0.1 Repository health and source of truth

- [x] Track only source/configuration files, not local Expo, Supabase or TypeScript state.
- [x] Use one root lockfile and one repeatable `npm run verify` command.
- [x] Run the quality gate in GitHub Actions.
- [x] Keep architecture, current state, roadmap and decisions aligned with code.

### M0.2 Reproducible Supabase

- Capture the hosted core schema as a reviewed baseline migration.
- Prove that a new local/preview database can be created from migrations alone.
- Add deterministic development seed data that contains no personal information.

### M0.3 Security hardening

- Add two-user RLS integration tests.
- Revoke unnecessary access to security-definer functions.
- Version-control Edge Function JWT settings.
- Add per-user AI quota, rate limiting and media/request-size limits.
- Protect and rate-limit finance proxy routes.

## M1 — Mobile alpha stabilization

- Test auth recovery, user switching, receipt, voice, transfers, investments, installments and credit-card cycles end to end.
- Add mobile error monitoring and privacy-safe diagnostics.
- Add account deletion/export and privacy disclosures.
- Configure EAS development, preview and production profiles.

## M2 — Maintainability

- Split oversized transaction, analytics and management components without changing behavior.
- Add component/integration coverage around transaction entry.
- Define pagination and server-side aggregate thresholds.
- Make base currency a user preference with a migration plan.

## M3 — Web product

- Replace the starter page with the authenticated Budgree shell.
- Reuse platform-neutral domain and data code from `packages/shared`.
- Implement the approved design system and preview deployment.

## Later product work

- Recurring bills and subscriptions
- Planned transactions and projections
- Push notifications
- Biometric app lock
- Bank integrations and recurring-payment detection
- Advanced investment analytics
