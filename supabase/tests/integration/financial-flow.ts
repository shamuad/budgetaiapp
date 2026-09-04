import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildInstallmentPlan } from '../../../packages/shared/lib/installmentPlan';
import { calculateBalancesByAsset } from '../../../packages/shared/lib/ledgerBalances';
import { billingMonthISO } from '../../../packages/shared/utils/billingMonth';
import type { Transaction, Asset } from '../../../packages/shared/types/database';
import type { TransactionInput } from '../../../packages/shared/lib/api/transactions';

function env(name: string) {
  const value = process.env[name];
  assert.ok(value, name + ' is required');
  return value;
}
async function main() {
  const url = env('SUPABASE_URL');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname),
    'Financial integration must only run against local Supabase');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), options);
  const client = createClient(url, env('SUPABASE_ANON_KEY'), options);
  const other = createClient(url, env('SUPABASE_ANON_KEY'), options);
  const users: string[] = [];
  try {
    for (const c of [client, other]) {
      const { data, error } = await c.auth.signUp({
        email: 'ledger-' + randomUUID() + '@example.com', password: 'Test-Ledger-123!',
      });
      assert.ifError(error);
      assert.ok(data.user);
      users.push(data.user.id);
      assert.ok(data.session);
    }
    const { data: accounts, error: accountError } = await client.from('assets').insert(
      ['bank', 'investment', 'card'].map(type => ({
        name: type, type, symbol: 'EUR', quantity: 0, purchase_price: 0, current_price: 0,
        currency: 'EUR', is_credit: type === 'card', statement_day: type === 'card' ? 15 : null,
      })),
    ).select('*').returns<Asset[]>();
    assert.ifError(accountError);
    assert.ok(accounts);
    const bank = accounts.find(a => a.type === 'bank')!;
    const investment = accounts.find(a => a.type === 'investment')!;
    const card = accounts.find(a => a.type === 'card')!;
    const base: TransactionInput = {
      title: 'Funding', amount: 1000, currency: 'EUR', exchange_rate: 1, type: 'income',
      date: '2026-12-15', billing_month: null, category_id: null, asset_id: bank.id,
      to_asset_id: null, asset_symbol: null, shares: null, unit_price: null, installment_group_id: null,
    };
    async function insert(input: TransactionInput | TransactionInput[]) {
      const { data, error } = await client.from('transactions').insert(input).select('*').returns<Transaction[]>();
      assert.ifError(error);
      assert.ok(data);
      return data;
    }
    async function ledger() {
      const { data, error } = await client.from('transactions').select('*').returns<Transaction[]>();
      assert.ifError(error);
      assert.ok(data);
      return data;
    }
    await insert(base);
    const [holding] = await insert({
      ...base, title: 'ETF purchase', type: 'transfer', amount: 200,
      to_asset_id: investment.id, asset_symbol: 'VUSA.AS', shares: 2, unit_price: 100,
    });
    let balances = calculateBalancesByAsset(await ledger());
    assert.equal(balances.get(bank.id), 800);
    assert.equal(balances.get(investment.id), 200);
    assert.equal(holding.shares, 2);
    assert.equal(holding.asset_symbol, 'VUSA.AS');
    // Editing and deleting a transfer must update both sides of the UI ledger.
    assert.ifError((await client.from('transactions').update({ amount: 300, shares: 3 }).eq('id', holding.id)).error);
    balances = calculateBalancesByAsset(await ledger());
    assert.equal(balances.get(bank.id), 700);
    assert.equal(balances.get(investment.id), 300);
    assert.equal([...balances.values()].reduce((a, b) => a + b, 0), 1000);
    assert.ifError((await client.from('transactions').delete().eq('id', holding.id)).error);
    assert.equal(calculateBalancesByAsset(await ledger()).get(bank.id), 1000);

    await insert({
      ...base, title: 'USD purchase', type: 'expense', amount: 100, currency: 'USD', exchange_rate: 0.9,
    });
    assert.equal(calculateBalancesByAsset(await ledger()).get(bank.id), 910);

    // A card purchase belongs to the inclusive cutoff month; repayment is a transfer.
    assert.equal(billingMonthISO('expense', new Date(2026, 11, 15), card), '2026-12-01');
    assert.equal(billingMonthISO('expense', new Date(2026, 11, 16), card), '2027-01-01');
    const groupId = randomUUID();
    const plan = buildInstallmentPlan({
      title: 'Laptop', amount: 100, installments: 3, type: 'expense', date: new Date(2026, 11, 16),
      asset: card, categoryId: null, currency: 'EUR', exchangeRate: 1, groupId,
    });
    const saved = await insert(plan);
    assert.equal(saved.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 10000);
    assert.deepEqual(saved.map(row => row.billing_month).sort(), ['2027-01-01', '2027-02-01', '2027-03-01']);
    assert.equal(calculateBalancesByAsset(await ledger()).get(card.id), -100);
    await insert({ ...base, title: 'Card repayment', type: 'transfer', amount: 100, to_asset_id: card.id,
      billing_month: billingMonthISO('transfer', new Date(2026, 11, 16), card) });
    balances = calculateBalancesByAsset(await ledger());
    assert.equal(balances.get(card.id), 0);
    assert.equal(balances.get(bank.id), 810);
    const beforeFailure = (await ledger()).length;
    const invalidBatch = await client.from('transactions').insert([
      { ...plan[0], installment_group_id: randomUUID() },
      { ...plan[1], asset_id: randomUUID() },
    ]);
    assert.ok(invalidBatch.error, 'An invalid row must reject the entire installment batch');
    assert.equal((await ledger()).length, beforeFailure, 'No partial plan may survive');
    const { data: isolated, error: isolationError } = await other.from('transactions').select('id');
    assert.ifError(isolationError);
    assert.deepEqual(isolated, []);
    assert.ifError((await other.from('transactions').delete().eq('installment_group_id', groupId)).error);
    assert.equal((await ledger()).filter(row => row.installment_group_id === groupId).length, 3);
    assert.ifError((await client.from('transactions').delete().eq('installment_group_id', groupId)).error);
    assert.equal((await ledger()).filter(row => row.installment_group_id === groupId).length, 0);
    console.log('Financial integration passed: transfers, holdings, FX, installments, card cycles, atomicity and isolation.');
  } finally {
    for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
