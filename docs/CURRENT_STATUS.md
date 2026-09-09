# Current Status

**Product stage:** authenticated mobile alpha
**Verified main snapshot:** `05d7f66feba7806cef0ebe1717d75bb6d789b87e` (PR #7 merged)
**Main checked:** 2026-09-07
**Post-merge CI:** both jobs successful, as confirmed by the product owner
**Delivery branch:** `design/dashboard` — [draft PR #9](https://github.com/shamuad/budgetaiapp/pull/9), stacked on `design/mobile-foundation`; [draft PR #8](https://github.com/shamuad/budgetaiapp/pull/8) remains unmerged

## Single active task

**Task:** Implement the approved Dashboard composition with real monthly and category summaries.
**Authorization:** product owner in the Product Design task, continued 2026-09-08.
**Scope of this delivery:** Dashboard masthead/balance card, account carousel, compact monthly income/expense/net, top-two-plus-other spending summary, five-cell navigation with centered New Transaction action, and Dashboard-to-Analytics account/month context. Existing account colors, selection, transaction entry and financial rules remain in place.
**Done when:** calculations are covered, root verification passes, native Light/Dark and navigation checks are recorded, and the user approves the relevant PR before merge.

## Immediate next step

The approved Dashboard is implemented locally on a stacked branch. Monthly figures use the same statement-month and stored exchange-rate semantics as Analytics; transfers do not count as income or expense. Account selection updates all Dashboard summaries in place, and the Analysis link carries the selected account and month. Root verification passed with 57 tests. Finish the branch handoff and review while keeping PR #8's merge approval separate.

The previous master-documentation gate closed with PR #7. Its old D2-only queue was stale. D2's Light / Dark B direction was accepted in the design conversation; remaining screen polish is iterative, not a reason to redesign the whole app before coding.

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
