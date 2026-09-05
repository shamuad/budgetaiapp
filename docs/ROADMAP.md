# Master Roadmap

This roadmap controls committed sequence across Budgree. `PRODUCT.md` defines the product, `CURRENT_STATUS.md` names the single active task, and `BACKLOG.md` holds uncommitted ideas.

## Status legend

- [x] completed and evidenced
- [ ] committed but not completed
- Blocked items state their dependency explicitly

## M0 — Foundation and professional operating baseline

### M0.1 Repository health and source of truth

- [x] Establish the npm-workspaces monorepo and one root lockfile.
- [x] Add repeatable root verification and GitHub Actions.
- [x] Make GitHub the implementation and project-documentation source of truth.
- [x] Record product, roadmap, current status, decisions, backlog and workstream gates.
- [x] Define latest-main, topic-branch, validation, PR, user-approval and merge flow.

### M0.2 Reproducible Supabase and security

- [x] Capture the hosted core schema as a reviewed baseline migration.
- [x] Rebuild a fresh local database from migrations and deterministic seed.
- [x] Add two-user RLS integration tests and relationship ownership checks.
- [x] Revoke unnecessary security-definer access.
- [x] Version-control Edge Function JWT settings.
- [x] Protect Gemini and finance endpoints with authenticated per-user quotas and input limits.
- [x] Deploy and smoke-test the hosted security baseline.

### M0.3 Core technical baseline

- [x] Implement authenticated mobile navigation and account recovery.
- [x] Implement accounts, categories and transaction CRUD.
- [x] Implement transfers, investments, installments and credit-card billing periods.
- [x] Implement core dashboard and analytics.
- [x] Implement Gemini-assisted text, push-to-talk voice, categorization and receipt/Vision entry.
- [x] Implement shared i18n for English, Turkish, Dutch and Spanish.
- [x] Implement semantic Light, Dark and Auto theme infrastructure.
- [x] Cover auth lifecycle, deterministic AI media flow and financial lifecycle through local-Supabase integration tests.

## D — Product design system

Figma is authoritative for approved design.

- [x] D0 — Figma file structure and working conventions.
- [x] D1 — Visual Direction: premium adaptive fintech, clear hierarchy, polished card structures, restrained glass surfaces and semantic color roles.
- [ ] D2 — Color System: approve primitives and semantic Light/Dark tokens, including distinct brand, Budgree/AI and financial-direction roles.
- [ ] D3 — Typography system.
- [ ] D4 — Spacing, grid, radius, elevation and icon rules.
- [ ] D5 — Core components and interaction states.
- [ ] D6 — Critical mobile flows and clickable prototype.
- [ ] D7 — Developer handoff and design QA.

Only one design stage is active at a time. Implementation must not pre-empt unapproved Figma decisions.

## M1 — Mobile alpha stabilization

- [x] Verify auth lifecycle against local Supabase.
- [x] Verify authenticated voice and receipt data through the local Edge Function with a deterministic Gemini fixture.
- [x] Verify transfers, investments, installments and credit-card cycles through shared calculations and local-Supabase API integration.
- [ ] Validate camera/microphone permissions and live Gemini accuracy on physical iOS and Android devices.
- [ ] Exercise financial lifecycle flows through native mobile screens on physical devices.
- [ ] Add privacy-safe mobile diagnostics and error monitoring.
- [ ] Add account export/deletion and privacy disclosures.
- [ ] Configure EAS development, preview and production profiles.

The remaining M1 work may be prepared while the design system progresses only when it does not create visual rework or violate the single-active-task rule.

## M2 — Mobile beta and maintainability

- [ ] Implement the approved beta-critical design system and flows.
- [ ] Split oversized transaction, analytics and management components without behavior changes.
- [ ] Add component/integration coverage around transaction entry.
- [ ] Define and implement pagination/server-aggregate thresholds.
- [ ] Implement the approved base-currency preference and migration policy.
- [ ] Complete accessibility, regression, privacy/security and preview-build gates.

## M3 — Web product

- [ ] Define the committed web product scope.
- [ ] Replace the starter page with the authenticated Budgree shell.
- [ ] Reuse platform-neutral domain and data code from `packages/shared`.
- [ ] Implement the approved design system for web interaction and accessibility.
- [ ] Produce and approve a preview deployment.

## M4 — Launch system

- [ ] Finalize brand masters, app icon and store assets.
- [ ] Produce website, support, privacy and AI-limitations content.
- [ ] Configure production mobile/web environments and monitoring.
- [ ] Complete store metadata, release notes and submission packages.
- [ ] Pass the release checklist with no open release-blocking defect.
- [ ] Approve public launch.

## Post-launch candidates

Recurring bills, projections, notifications, biometrics, bank integrations and advanced investment analytics remain governed in `BACKLOG.md` until explicitly promoted.
