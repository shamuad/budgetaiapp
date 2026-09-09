import type { TransactionRow } from './api/transactions';
import { transactionPeriodDate } from './valueParsing';

type SummaryRow = Pick<TransactionRow, 'type' | 'amount' | 'exchange_rate' | 'date' | 'billing_month' | 'asset_id' | 'to_asset_id' | 'category_id' | 'category'>;

/** Same inclusive/exclusive statement-period window as Analytics. Transfers remain in the filtered ledger. */
export function selectPeriodTransactions<T extends SummaryRow>(rows: readonly T[], start: Date, end: Date, accountId?: string | null): T[] {
  return rows.filter(row => {
    if (accountId && row.asset_id !== accountId && row.to_asset_id !== accountId) return false;
    const date = transactionPeriodDate(row);
    return date !== null && date >= start && date < end;
  });
}

/** Recorded cash flow, not account balance: transfers never count as income or spending. */
export function summarizeDashboard(rows: readonly SummaryRow[], start: Date, end: Date, accountId?: string | null) {
  let income = 0;
  let expense = 0;
  const categories = new Map<string, { key: string; category: SummaryRow['category']; amount: number }>();
  for (const row of selectPeriodTransactions(rows, start, end, accountId)) {
    if (row.type === 'transfer') continue;
    const amount = row.amount * row.exchange_rate;
    if (row.type === 'income') {
      income += amount;
      continue;
    }
    expense += amount;
    const key = row.category_id ?? '__uncategorized__';
    const item = categories.get(key);
    if (item) item.amount += amount;
    else categories.set(key, { key, category: row.category, amount });
  }
  const ranked = [...categories.values()].sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
  const topCategories = ranked.slice(0, 2);
  const otherAmount = ranked.slice(2).reduce((total, item) => total + item.amount, 0);
  return { income, expense, net: income - expense, topCategories, otherAmount };
}
