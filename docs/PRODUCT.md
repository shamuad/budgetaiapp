# Product

## Product vision

Budgree helps people understand and manage everyday money with less manual work and more confidence. It combines trustworthy personal-finance records with AI-assisted capture so a user can add a transaction by typing, holding to speak or scanning a receipt, then review the result before it affects their financial picture.

The mobile app is the primary product. Web, marketing and brand work support the same product promise but do not define mobile behavior independently.

## Target user and job to be done

The initial target is an individual managing personal accounts, cards, spending, income and investments who wants one clear view without maintaining a complex spreadsheet.

> When money moves, help me record it quickly and correctly, understand where it went, and see whether my behavior matches my plan.

This target is a product hypothesis until validated with users; it must not be narrowed or expanded silently.

## Product promise

- Fast capture through text, push-to-talk voice and receipt scanning.
- User confirmation before AI-derived data becomes a financial record.
- Correct treatment of income, expense and internal transfers.
- A useful view of accounts, cash flow, categories, budgets and investments.
- A premium, calm interface that works in Light, Dark and Auto modes.
- English, Turkish, Dutch and Spanish support through the shared i18n architecture.
- Privacy and security appropriate for sensitive financial data.

## Product principles

1. **Trust before automation.** AI suggests; the user remains in control.
2. **Financial correctness before visual convenience.** Transfers never inflate income or expense, and stored exchange rates preserve historical meaning.
3. **Private by design.** Credentials stay server-side, tenant data is isolated with RLS, and sensitive details are minimized in logs and notifications.
4. **One product, shared domain.** Mobile and web reuse platform-neutral domain, data and i18n code where appropriate.
5. **Accessible polish.** Approved Figma design, semantic tokens, readable contrast and at least 44pt mobile touch targets guide implementation.
6. **Evidence over conversation.** A feature is implemented only when the repository and relevant checks prove it.
7. **Small, reviewable delivery.** One scoped task moves through branch, checks, PR and user approval.

## MVP scope

### Included

- Authentication, protected navigation and account recovery.
- Personal account, category and transaction management.
- Income, expense, transfer, investment, installment and credit-card-cycle handling.
- Dashboard and core analytics, including the Needs / Wants / Savings direction.
- Gemini-assisted text, voice, categorization and receipt entry.
- Multi-currency transaction storage with a fixed historical exchange rate.
- Light, Dark and Auto theme support based on approved semantic color tokens.
- Privacy operations, account export/deletion, diagnostics and a repeatable release path before public launch.

### Not in the initial release

- Automatic bank connections or recurring-payment detection.
- Trading execution, investment recommendations or tax advice.
- Advanced investment analytics.
- Full mobile/web feature parity.
- Social, family-sharing or business-account features.

These items may remain in the backlog but must not enter implementation without milestone placement.

## Product guardrails

- Do not replace or simplify the Gemini/Vision integration without an explicit product and technical decision.
- Preserve push-to-talk voice interaction.
- Do not expose Gemini secrets in the client.
- Do not hardcode new interface colors; use semantic theme tokens approved through Product Design.
- Do not treat internal account or investment movement as income or expense.
- Do not present AI output as guaranteed fact.
- Do not put sensitive financial amounts on lock-screen notifications by default.

## Release outcomes

### Alpha exit

- Core financial flows are correct in automated integration coverage.
- Core flows are exercised through native screens on physical iOS and Android devices.
- Live voice and receipt behavior is validated on both platforms.
- Known critical security defects are resolved.

### Beta exit

- Approved design system is implemented for the beta-critical mobile flows.
- Privacy disclosures, export/deletion and privacy-safe diagnostics work.
- EAS preview builds are repeatable.
- No open release-blocking defects.

### Public release exit

- Production environments, store assets, support/privacy content and release monitoring are ready.
- A regression pass and release checklist are approved.
- Website and marketing claims match shipped behavior.
