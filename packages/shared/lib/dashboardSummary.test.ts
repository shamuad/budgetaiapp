import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPeriodTransactions, summarizeDashboard } from './dashboardSummary';

type Row = Parameters<typeof summarizeDashboard>[0][number];
const start = new Date(2026, 8, 1);
const end = new Date(2026, 9, 1);
const row = (patch: Partial<Row> = {}): Row => ({ type: 'expense', amount: 10, exchange_rate: 1, date: '2026-09-01', billing_month: null, asset_id: 'bank', to_asset_id: null, category_id: null, category: null, ...patch });

test('monthly cash flow excludes transfers, uses stored FX and scopes source accounts', () => {
  const rows = [row({ type: 'income', amount: 1000 }), row({ amount: 100, exchange_rate: 0.5 }), row({ type: 'transfer', amount: 900, to_asset_id: 'card' }), row({ amount: 30, asset_id: 'card' })];
  const all = summarizeDashboard(rows, start, end);
  assert.equal(all.income, 1000); assert.equal(all.expense, 80); assert.equal(all.net, 920);
  const card = summarizeDashboard(rows, start, end, 'card');
  assert.equal(card.income, 0); assert.equal(card.expense, 30); assert.equal(card.net, -30);
  assert.equal(selectPeriodTransactions(rows, start, end, 'card').length, 2, 'transfer destination remains in the scoped ledger');
});

test('statement month takes precedence, period end is exclusive and invalid dates are excluded', () => {
  const result = summarizeDashboard([
    row({ date: '2026-08-20', billing_month: '2026-09-01', amount: 20 }),
    row({ date: '2026-09-25', billing_month: '2026-10-01', amount: 99 }),
    row({ date: '2026-10-01', amount: 99 }), row({ date: '2026-08-31', amount: 99 }),
    row({ date: '2026-09-30', amount: 30 }), row({ date: 'invalid', amount: 99 }),
  ], start, end);
  assert.equal(result.expense, 50);
});

test('category identity, uncategorized spending and top two plus remainder reconcile to total', () => {
  const result = summarizeDashboard([
    row({ category_id: 'home', amount: 50 }), row({ category_id: 'home', amount: 10 }),
    row({ category_id: 'food', amount: 30 }), row({ category_id: 'travel', amount: 15 }), row({ amount: 5 }),
  ], start, end);
  assert.deepEqual(result.topCategories.map(item => [item.key, item.amount]), [['home', 60], ['food', 30]]);
  assert.equal(result.otherAmount, 20);
  assert.equal(result.topCategories.reduce((sum, item) => sum + item.amount, result.otherAmount), result.expense);
});

test('empty months produce a truthful zero state without invented categories', () => {
  assert.deepEqual(summarizeDashboard([], start, end), { income: 0, expense: 0, net: 0, topCategories: [], otherAmount: 0 });
});
