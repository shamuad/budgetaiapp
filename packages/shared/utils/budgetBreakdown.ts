import type { TransactionRow } from '../lib/api/transactions';
import { toBaseAmount } from '../lib/format';

export type BudgetBreakdown = {
  income: number;
  needs: number;
  wants: number;
  savings: number;
  /** Actual share of income, 0-1 (can exceed 1 when spending outpaces income). */
  needsShare: number;
  wantsShare: number;
  savingsShare: number;
};

/**
 * The 50/30/20 picture for a period, from transactions already filtered to
 * that window. Needs/Wants come straight from each expense's `group_code`.
 *
 * Savings is deliberately NOT a `group_code` — per the app's double-entry
 * rule, money set aside is a `transfer`, never an expense category (see the
 * `group_code` comment on `Category`). So Savings is the sum of transfers
 * whose destination account is type `investment`, the app's only concrete
 * signal for a "designated savings/investment account" today. A transfer
 * between two everyday spending accounts is neither a spend nor a saving,
 * and is correctly ignored here — exactly like it's ignored in net cash flow.
 */
export function calculateBudgetBreakdown(transactions: TransactionRow[]): BudgetBreakdown {
  let income = 0;
  let needs = 0;
  let wants = 0;
  let savings = 0;

  for (const row of transactions) {
    const amount = toBaseAmount(row.amount, row.exchange_rate);

    if (row.type === 'income') {
      income += amount;
    } else if (row.type === 'expense') {
      if (row.category?.group_code === 'needs') {
        needs += amount;
      } else if (row.category?.group_code === 'wants') {
        wants += amount;
      }
    } else if (row.type === 'transfer' && row.to_asset?.type === 'investment') {
      savings += amount;
    }
  }

  const shareOfIncome = (amount: number) => (income > 0 ? amount / income : 0);

  return {
    income,
    needs,
    wants,
    savings,
    needsShare: shareOfIncome(needs),
    wantsShare: shareOfIncome(wants),
    savingsShare: shareOfIncome(savings),
  };
}
