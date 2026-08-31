import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addBillingMonths,
  addMonthsClamped,
  billingMonthISO,
  installmentSliceDate,
  resolveBillingMonth,
} from './billingMonth';

describe('resolveBillingMonth', () => {
  it('keeps purchases on or before the cutoff in the same month', () => {
    const august = resolveBillingMonth(new Date(2026, 7, 10), 15);
    assert.equal(august.getFullYear(), 2026);
    assert.equal(august.getMonth(), 7);
    assert.equal(august.getDate(), 1);

    const onCutoff = resolveBillingMonth(new Date(2026, 7, 15), 15);
    assert.equal(onCutoff.getMonth(), 7);
  });

  it('rolls purchases after the cutoff into the next month', () => {
    const next = resolveBillingMonth(new Date(2026, 7, 16), 15);
    assert.equal(next.getFullYear(), 2026);
    assert.equal(next.getMonth(), 8);
    assert.equal(next.getDate(), 1);

    const endOfMonth = resolveBillingMonth(new Date(2026, 7, 31), 15);
    assert.equal(endOfMonth.getMonth(), 8);
  });

  it('wraps December into January of the next year', () => {
    const january = resolveBillingMonth(new Date(2026, 11, 20), 15);
    assert.equal(january.getFullYear(), 2027);
    assert.equal(january.getMonth(), 0);
    assert.equal(january.getDate(), 1);
  });

  it('rejects a cutoff outside 1–28', () => {
    assert.throws(() => resolveBillingMonth(new Date(2026, 7, 10), 29), RangeError);
    assert.throws(() => resolveBillingMonth(new Date(2026, 7, 10), 0), RangeError);
  });
});

describe('addBillingMonths', () => {
  it('advances a first-of-month by N months across a year wrap', () => {
    const next = addBillingMonths(new Date(2026, 10, 1), 3);
    assert.equal(next.getFullYear(), 2027);
    assert.equal(next.getMonth(), 1);
    assert.equal(next.getDate(), 1);
  });
});

describe('addMonthsClamped', () => {
  it('clamps 31 January into February instead of overflowing to March', () => {
    const feb = addMonthsClamped(new Date(2026, 0, 31), 1);
    assert.equal(feb.getMonth(), 1);
    assert.equal(feb.getDate(), 28);
  });
});

describe('installmentSliceDate', () => {
  it('keeps slice 0 on the purchase day and later slices on the statement day', () => {
    const purchase = new Date(2026, 7, 20);
    const first = resolveBillingMonth(purchase, 15);
    const slice0 = installmentSliceDate(purchase, 0, 15, first);
    const slice1 = installmentSliceDate(purchase, 1, 15, first);

    assert.equal(slice0.getFullYear(), 2026);
    assert.equal(slice0.getMonth(), 7);
    assert.equal(slice0.getDate(), 20);

    // 20 Aug is after the 15th, so first billing is September; slice 1 is October 15.
    assert.equal(first.getMonth(), 8);
    assert.equal(slice1.getMonth(), 9);
    assert.equal(slice1.getDate(), 15);
  });
});

describe('billingMonthISO', () => {
  it('returns null for transfers and non-credit accounts', () => {
    const date = new Date(2026, 7, 20);
    assert.equal(billingMonthISO('transfer', date, { is_credit: true, statement_day: 15 }), null);
    assert.equal(billingMonthISO('expense', date, { is_credit: false, statement_day: null }), null);
  });

  it('snapshots the first of the billing month for a credit expense', () => {
    assert.equal(
      billingMonthISO('expense', new Date(2026, 7, 20), { is_credit: true, statement_day: 15 }),
      '2026-09-01',
    );
    assert.equal(
      billingMonthISO('income', new Date(2026, 7, 10), { is_credit: true, statement_day: 15 }),
      '2026-08-01',
    );
  });
});
