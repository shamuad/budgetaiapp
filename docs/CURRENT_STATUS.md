# Current Status

**Product stage:** authenticated mobile alpha
**Verified main snapshot:** `8f6871f` (approved Dashboard and reporting currency promoted)
**Main checked:** 2026-09-12
**Current task validation:** see the authentication PR; native/provider acceptance remains open
**Delivery branch:** `feat/auth-redesign`

## Single active task

**Task:** Implement the approved Budgree welcome and authentication redesign.
**Authorization:** product owner in the welcome/auth design workstream, 2026-09-12.
**Branch:** `feat/auth-redesign`, from current `main` at `8f6871f` (Dashboard promotion).
**Scope:** approved logo/welcome, login/signup, Magic Link, confirmation/resend, password recovery, Google/Apple OAuth, callback and error states. See [Auth redesign handoff](AUTH_REDESIGN.md).
**Done when:** automated gates pass, hosted provider/email configuration and native iOS/Android checks are recorded, and the user approves the PR before merge.

## Immediate next step

Finish validation and PR review for authentication, then verify the real email/OAuth callbacks in development builds. Provider configuration and physical-device acceptance remain explicit open checks. Dashboard visual exploration stays outside this task.

The previous Dashboard implementation was promoted to `main` in `8f6871f`; the older `design/dashboard` / stacked PR status below is historical evidence, not the current delivery branch.

## Reconciled baseline

### Verified in GitHub

- npm-workspaces monorepo with Expo/React Native mobile, Next.js web, shared package and Supabase.
- Authenticated mobile alpha with protected routes, email/password auth, recovery and session switching.
- Owner-scoped financial data and profiles protected through RLS, including referenced relationship checks.
- Reproducible local Supabase schema and deterministic non-personal seed.
- Accounts, categories, transactions, transfers, investments, installments and credit-card billing periods.
- Dashboard and analytics, TanStack Query server state and Zustand client state.
- English, Turkish, Dutch and Spanish i18n.
- Semantic Light, Dark and Auto theme infrastructure.
- Server-side Gemini text, push-to-talk voice, categorization and receipt/Vision flows.
- Authenticated per-user quotas and input limits for Gemini and finance proxy routes.
- Local integration coverage for auth lifecycle, deterministic AI media flow and financial lifecycle.
- The earlier baseline passed both CI jobs at `2bb6f4d`; PR #7 added the operating-system documentation.
- PRs #1 through #7 were merged to `main`.

### Confirmed project/design state

These are project records supplied by the product owner; Figma remains authoritative for the visual artifacts:

- D0 Figma file structure is complete.
- D1 Visual Direction is complete.
- D2 Light and Dark B is the accepted palette; category references have been revised against existing code.
- Approved direction is premium adaptive fintech: clear hierarchy, polished card structures, restrained glass surfaces and clean typography.
- Brand/UI color roles remain distinct: structural `brand`, Budgree/AI accent and financial income/expense semantics.

## Important reconciliation corrections

- Earlier history said auth and RLS were absent; GitHub now proves they are implemented and tested.
- Earlier history described financial lifecycle validation as open; PR #6 added shared calculation and local-Supabase integration coverage.
- Native-screen financial regression and physical-device voice/receipt checks remain open; API/integration coverage does not prove them.
- The previous status stopped at `2bb6f4d`; verified main is now `05d7f66`. This branch records the subsequent design and implementation handoff.
- GitHub has no repository ruleset enforcing branch protection. The documented PR and user-approval process is therefore a required human control until protection is configured.

## Verification evidence

- Local first-slice verification: lint, all workspace typechecks, 53 unit tests and web production build passed on 2026-09-07. iOS Metro/Hermes bundle export passed; this is not a native visual acceptance test.
- Database CI: clean migration rebuild; auth, AI-media and financial integration scripts; schema, RLS and quota pgTAP tests.
- Hosted security record: hosted migration history aligned through the recorded security baseline; `ask-gemini` JWT enforcement and unauthenticated rejection were previously smoke-tested.

The repeatable CI result is authoritative; recorded test counts describe this branch snapshot.
- Management persistence coverage passed in [CI run 34160248572](https://github.com/shamuad/budgetaiapp/actions/runs/34160248572): category hide/restore, custom edit/delete, transaction-reference preservation, account ordering after refetch and cross-user isolation. Both verification and database jobs succeeded at `b7d442f`. Subsequent presentation changes require their own green PR checks.

## Open alpha blockers

1. Physical iOS and Android camera/microphone permissions and live Gemini accuracy.
2. Native-screen regression for transfers, investments, installments and credit-card cycles.
3. Privacy-safe diagnostics and operational monitoring.
4. Account export/deletion and privacy disclosures.
5. EAS development, preview and production profiles.

## Controlled technical debt

- `AddTransactionModal` and several analytics/management components are oversized.
- The full ledger is fetched and aggregated on the client.
- Canonical ledger conversion remains EUR by design; the user can select a separate reporting currency for Dashboard and Analytics totals.
- The visible web page remains a framework starter.
- Merged topic branches remain on the remote and can be cleaned up separately; cleanup is not the active task.
