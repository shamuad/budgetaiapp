# Financial transaction coverage

The mobile installment form uses `buildInstallmentPlan`; the account query uses
`calculateBalancesByAsset`. Both functions run in the financial integration
scenario against rows written and read through authenticated local Supabase.

Covered scenarios:

- Investment transfer creation, editing and deletion update both account balances while preserving the combined balance.
- Investment symbol and share count survive storage.
- Foreign-currency transactions use their stored exchange rate.
- Installments preserve the total in cents and clamp shorter calendar months.
- Credit plans preserve statement-month snapshots across December/January.
- Card repayment is a transfer, without an income/expense statement month.
- An invalid row rejects the entire installment insert; no partial plan remains.
- Another user cannot read or delete the plan; the owner can delete the complete group.

Unit tests cover all installment counts from 2 through 60 with small totals and
rounding remainders. Totals below one cent per payment are rejected.

The integration script refuses hosted Supabase URLs. CI runs it after rebuilding
the local schema. It creates temporary users and removes them afterwards.

These are calculation and API integration tests. Native form interaction,
investment market valuation, full analytics rendering and physical-device
end-to-end testing remain outside this coverage.
