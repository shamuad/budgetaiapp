import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Asset, Category } from '../types/database';
import {
  AIResponseError,
  parseReceiptAIResponse,
  parseTransactionAIResponse,
} from './aiResponse';
import { toISODate } from './valueParsing';

const groceries: Category = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Food Groceries',
  type: 'expense',
  icon: '🛒',
  is_custom: false,
  translation_key: 'category_food_groceries',
  is_active: true,
  group_code: 'needs',
  color_code: null,
  created_at: '2026-09-04T00:00:00Z',
};

const salary: Category = {
  ...groceries,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Salary',
  type: 'income',
  icon: '💼',
  translation_key: 'category_salary',
  group_code: null,
};

const card: Asset = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Daily Card',
  symbol: 'EUR',
  type: 'card',
  icon: '💳',
  custom_color: null,
  payment_clue: '0718',
  is_credit: false,
  statement_day: null,
  sort_order: 0,
  quantity: 0,
  purchase_price: 0,
  current_price: 0,
  currency: 'EUR',
  created_at: '2026-09-04T00:00:00Z',
};

describe('AI media response mapping', () => {
  it('maps a voice response onto the user-owned category and account', () => {
    const result = parseTransactionAIResponse(
      JSON.stringify({
        title: 'Albert Heijn',
        amount: '42,50',
        type: 'expense',
        category: 'Food Groceries (expense)',
        account_name: 'daily card',
        currency: 'euro',
        installments: 1,
        date: '2026-09-04',
        action: 'none',
      }),
      [groceries, salary],
      [card],
      new Date(2026, 0, 1),
    );

    assert.equal(result.action, 'none');
    assert.equal(result.values?.amount, 42.5);
    assert.equal(result.values?.category?.id, groceries.id);
    assert.equal(result.values?.asset?.id, card.id);
    assert.equal(result.values?.currency, 'EUR');
    assert.equal(toISODate(result.values!.date), '2026-09-04');
    assert.deepEqual(result.aiFilled, ['amount', 'title', 'currency', 'date', 'category', 'asset']);
  });

  it('maps a receipt response by ids and never auto-saves it', () => {
    const result = parseReceiptAIResponse(
      JSON.stringify({
        title: 'Albert Heijn',
        amount: 42.5,
        currency: 'EUR',
        date: '2026-09-04',
        category_id: groceries.id,
        account_id: card.id,
        type: 'expense',
        installments: 2,
      }),
      [groceries, salary],
      [card],
      new Date(2026, 0, 1),
    );

    assert.equal(result.action, 'none');
    assert.equal(result.values?.category?.id, groceries.id);
    assert.equal(result.values?.asset?.id, card.id);
    assert.equal(result.values?.installments, 2);
    assert.equal(result.values?.toAsset, null);
  });

  it('does not guess a category when a receipt invents an id', () => {
    const result = parseReceiptAIResponse(
      JSON.stringify({ amount: 12, category_id: 'invented-id', type: 'expense' }),
      [groceries],
      [card],
      new Date(2026, 0, 1),
    );

    assert.equal(result.values?.category, null);
  });

  it('returns stable error codes for malformed and amount-less model replies', () => {
    assert.throws(
      () => parseTransactionAIResponse('not-json', [groceries], [card], new Date()),
      (error) => error instanceof AIResponseError && error.code === 'invalid_response',
    );
    assert.throws(
      () => parseReceiptAIResponse('{"amount": 0}', [groceries], [card], new Date()),
      (error) => error instanceof AIResponseError && error.code === 'no_amount',
    );
  });
});
