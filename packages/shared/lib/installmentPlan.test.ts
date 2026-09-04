import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstallmentPlan } from './installmentPlan';

const input = {
  title: 'Purchase', amount: 100, installments: 3, type: 'expense' as const,
  date: new Date(2026, 0, 31),
  asset: { id: 'card', is_credit: false, statement_day: null as number | null },
  categoryId: 'groceries', currency: 'EUR' as const, exchangeRate: 1, groupId: 'plan',
};

test('installments preserve cents across all permitted counts without zero or negative rows', () => {
  for (let count = 2; count <= 60; count++) {
    for (const cents of [count, count + 1, count * 2 - 1, 10000]) {
      const rows = buildInstallmentPlan({ ...input, amount: cents / 100, installments: count });
      assert.equal(rows.length, count);
      assert.ok(rows.every(row => row.amount >= 0.01));
      assert.equal(rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), cents);
    }
  }
});
test('ordinary installments clamp short months without skipping February', () => {
  const rows = buildInstallmentPlan(input);
  assert.deepEqual(rows.map(row => row.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(rows.map(row => row.amount), [33.34, 33.33, 33.33]);
  assert.ok(rows.every(row => row.billing_month === null && row.installment_group_id === 'plan'));
});
test('credit plan snapshots cross-year statement months after inclusive cutoff', () => {
  const rows = buildInstallmentPlan({
    ...input, date: new Date(2026, 11, 16),
    asset: { ...input.asset, is_credit: true, statement_day: 15 },
  });
  assert.deepEqual(rows.map(row => row.billing_month), ['2027-01-01', '2027-02-01', '2027-03-01']);
  assert.deepEqual(rows.map(row => row.date), ['2026-12-16', '2027-02-15', '2027-03-15']);
});
test('rejects plans too small to allocate a cent per payment and invalid inputs', () => {
  for (const overrides of [
    { amount: 0.01 }, { amount: NaN }, { installments: 1 },
    { installments: 61 }, { installments: 2.5 }, { exchangeRate: 0 },
  ]) assert.throws(() => buildInstallmentPlan({ ...input, ...overrides }), RangeError);
});
