# Mobile design → implementation handoff

Recorded 2026-09-07. This document accompanies `design/mobile-foundation`, based on main `05d7f66`. It does not claim that the branch has merged or all mobile screens have been redesigned.

## Authoritative inputs and delivery order

- GitHub code and project documents define implemented behavior; approved Figma defines visual direction.
- [Budgree Figma file](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi/Budgree-Product-Design) retains its existing Foundations, Components, Mobile, Web App, Website, Prototypes and Archive pages.
- The owner accepted Light / Dark B and requested categories, then gradual coding and a working app before more design polish.
- Do not infer cross-task synchronization. Read this file, CURRENT_STATUS, ROADMAP and the current code at each handoff.

## Category design references

All nodes below live in **03 Mobile**. These are editable design references with representative prototype links, not an executable form or persisted data.

| Reference | Figma node |
|---|---|
| Expense list / Light | [83:17](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi?node-id=83-17) |
| Expense list / Dark B | [114:289](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi?node-id=114-289) |
| Edit default expense / Light | 83:90 |
| Edit default expense / Dark B | 114:340 |
| Income list / edit income | 107:164 / 108:229 |
| New expense / edit custom category | 107:236 / 108:197 |
| Hide confirmation / hidden result / restored result | 109:213 / 111:219 / 111:263 |
| Delete confirmation / used-category rejection | 110:215 / 110:221 |
| Missing expense budget group | 110:228 |

The prototype demonstrates selected routes, including hide/restore and used-category rejection. It does not simulate arbitrary text entry, successful save of arbitrary new values, every emoji choice, unused-category deletion or every theme transition. Those behaviors remain implemented in the native editor. Dark variants establish visual treatment; not every secondary popup has a separate dark prototype.

Existing code audited: `ManageCategoriesModal.tsx`, `EntryEditor.tsx`, category hooks and grouping utilities. Categories are alphabetical, not draggable. Default categories can be hidden/restored; old transactions retain their references. Custom deletion rechecks transaction usage. Expense creation requires needs/wants; income does not. Changing a default name deliberately severs localization while icon-only changes preserve it. No new category color picker is introduced.

## This code slice

1. `theming/tokens.ts`: map approved D2 background, surface, text, interaction and income/expense roles into existing dynamic theme infrastructure. Saturated action fill stays violet with white text in both themes. Legacy static palette consumers have not been migrated.
2. `SegmentedControl.tsx`: filled violet selection, explicit accessibility selected state and at least 44-point touch height. Shared by settings and form selectors. Transaction amount coloring stays semantic; the selector itself follows the shared treatment.
3. `ManageCategoriesModal.tsx`: soft independent rows, 44-point tinted emoji wells, roomier spacing and legible hidden rows. Retains the virtualized SectionList, localized labels and default-category globe indicator from working code. No mutation or persistence changes.
4. Account editor: compact bank halo and card preview, rounded form surface and gradient-safe logo background. Bank detection, custom emoji, payment clue, hue/presets, account type, debit/credit, statement day, validation and deletion remain in place.
5. Native category editor composition, Dashboard composition and other full-screen migrations remain for the next slices. This is not a claim that every Figma frame has already been implemented.

Figma's 40-point visual segment was implemented with the existing 44-point touch minimum; the track therefore grows slightly. Use system-native typography already shipped in the app; no new font dependency was added. This deliberate adaptation needs native visual review.

## Protected product decisions

- Accounts keep drag-and-drop ordering, real bank identity, account-edit color/gradient choice and preview. Selecting a Dashboard account filters calculations on the same page.
- Settings keeps account/category management. The upper-right Dashboard control opens Figma node `36:3` as a rounded bottom sheet with Appearance, Management, and Session & Data groups; the legacy anchored popover is retired.
- Dashboard's center plus opens New Transaction; smart text, hold-to-speak and receipt entry belong there. The plus stays anchored to navigation.
- Account pagination is compact dots. Income is green, expense red and monthly net neutral. Keep a compact top-category spending summary with an Analysis link; do not invent a budget percentage when no matching budget model exists.
- Existing receipt/voice/text assistance is separate from the planned full AI Assistant. The latter and conditional family sharing remain in BACKLOG.

## Verification and remaining evidence

- Root lint, all workspace typechecks, 53 existing unit tests and web production build passed locally on 2026-09-07.
- iOS Metro/Hermes bundle export passed. This is a bundle check, not a signed native build or authenticated-device test.
- Figma Light and Dark B list renders inspected. Native follow-up evidence is recorded below; large-text and broader device coverage remain open.
- No database, RLS, Edge Function, financial calculation, schema or dependency changes. Existing account appearance tests pass. The initial presentation-only pass did not rerun database suites; the management follow-up below adds and verifies isolated persistence coverage.
- This machine used Node 26; repository setup/CI targets Node 22. CI remains the clean-environment gate.
- The owner supplied the existing local project path. Public mobile connection values were reused in ignored local environment files; values and user data are not committed. No production rows were copied into fixtures.

## Next acceptance checklist

1. Open the app using the existing configured environment, review category list/editor in Light, Dark B and Auto.
2. Exercise create, edit, hide, restore and used/unused custom deletion; confirm localization and needs/wants validation.
3. Verify account ordering and Dashboard filtering remain intact; test shared selection controls in Settings and New Transaction.
4. User reviews the PR and native screenshots. Merge only after explicit approval.
5. Continue Dashboard and remaining editor migrations as separate bounded deliveries, using the existing behavior inventory. Revisit visual details on the running app.

Rollback: revert the presentation commit through a PR. No data migration is required.

## Native follow-up — 2026-09-07

- Started this branch in the existing iPhone 17 / iOS 26.5 simulator through Expo Go 57. The existing session and account/transaction data loaded successfully.
- Visually checked the real expense and income category lists, selector switching, and opening/cancelling an existing income category editor. The income editor has no expense budget-group controls.
- Checked Light → Dark B → Light theme switching. Inspected the Settings filled selector, category card separation, account bank logos and reorder handles. Original Light preference was restored.
- Found and fixed remaining foreground uses of the filled-action `brand` color: navigation, links, indicators and active control borders now use the readable `tint` role. Filled buttons still use `brand` and white text. Inactive reorder handles use `textMuted` instead of faint placeholder coloring.
- Account order and financial records were not modified. Presence of reorder handles is verified; actual drag persistence, category save/hide/restore/delete and full financial lifecycle were not exercised against the owner's live data.
- Mobile preview runs on localhost:8082, with live reload; the owner's existing server on 8081 was preserved. The local Next finance API was configured separately on 127.0.0.1:3000 using the same public Supabase connection; unauthenticated request rejection is checked separately from authenticated market-data behavior.
- `npm run verify` passed again after the foreground contrast fixes. CI also passed for the foreground-contrast follow-up and the management-test commit; each later commit still requires its own green checks.
- Native screenshots were inspected privately in the simulator, not uploaded with personal finance data. Remaining review: large text, all supported locales, Android/physical devices, persisted CRUD and reorder behavior in disposable test data.

## Settings sheet follow-up — 2026-09-08

- Replaced the legacy header-anchored popover with the approved Figma `Settings — Açık` bottom sheet (`36:3`): 28-point top corners, dimmed backdrop, 24-point side inset, filled appearance selector and grouped management/session rows.
- Preserved Manage Accounts, Manage Categories, Light/Dark/System preference, clear-data confirmation and logout confirmation. Verified the two management destinations open and return to Settings; checked Light → Dark B → Light and restored Light without changing financial records.

## Account editor and persistence follow-up — 2026-09-07

- Account visual reference: [83:7](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi?node-id=83-7). Applied a 92-point bank halo, 20-point outer inset, 24-point form radius and a 321:154 card preview with 22-point radius. Use accepted D2 semantic colors and real bank assets from code.
- The reference does not show every account field. Existing account-type, debit/credit and statement-day controls remain below the preview. Four-choice selectors use two equal columns after the single-row Investment label wrapped awkwardly in the simulator; two/three-choice controls stay on one row. This is a native layout adaptation for review, not a claim of an identical Figma frame.
- Fixed gradient selection passing serialized gradient data as a native background color. The bank halo now uses the resolved first gradient stop.
- iPhone 17 simulator: checked Gold preview/halo, Card → Credit → statement-day visibility, Cancel, reopening the original Bank/orange state, and the final two-column labels. No saved account changes or financial mutations.
- Added `test:integration:management` to the isolated GitHub database job. It creates disposable users, tests default-category hide/restore while retaining transaction references and localization metadata, custom-category create/edit/unused delete, persisted account ordering after refetch and cross-user update isolation. It rejects non-local database URLs and cleans up only its disposable users.
- [CI run 34160248572](https://github.com/shamuad/budgetaiapp/actions/runs/34160248572) passed both jobs at `b7d442f`, including the new management test. Root verification passed before the final selector-wrap adjustment; mobile typecheck and diff checks passed after that adjustment. The final PR head must pass CI before merge.
- These API-level tests do not exercise native drag gestures, UI deletion confirmations, concurrent deletion races, keyboard behavior or physical-device accessibility. Those remain separate acceptance work.

## Dashboard implementation follow-up — 2026-09-08

- Implemented the approved Light node `8:2` and Dark B node `63:2` using the existing React Native components and semantic theme tokens. The layout uses a gradient masthead, overlapping balance surface, compact account cards and pagination, monthly overview, bounded spending summary and five equal navigation cells.
- Monthly income, expense and net are computed from real ledger rows using the same billing-period date and stored exchange-rate rules as Analytics. Transfers are excluded from cash-flow totals. Spending shows the two largest categories plus a reconciled Other amount, so the card height stays bounded.
- Selecting an account still filters the Dashboard in place. The selection now also scopes monthly totals, category spending and recent activity. `View analysis` passes the selected account and month to Analytics, where the scope can be cleared back to all accounts.
- The center Add action stays inside the safe-area-aware bottom bar and opens the existing New Transaction modal. The Assistant cell uses the exact Figma-exported icon but remains disabled and explicitly labelled as planned; no assistant capability was added.
- Native iPhone 17 simulator checks covered account filtering, Analysis context transfer and clearing, Add opening, settings anchoring, Light and Dark B rendering. The owner's theme preference was restored to Light; no financial row was saved or deleted.
- Root verification passed on 2026-09-08: lint, all typechecks, 57 tests and the web production build. Four new unit tests cover monthly cash flow, statement-month boundaries, account scope, category reconciliation and empty state.
- [Draft PR #9](https://github.com/shamuad/budgetaiapp/pull/9) is stacked on the unmerged mobile-foundation branch. Review and merge order must preserve that dependency; PR #8 still requires explicit product approval.
