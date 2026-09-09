import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function env(name: string) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

async function main() {
  const url = env('SUPABASE_URL');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname),
    'Management integration must only run against local Supabase');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), options);
  const owner = createClient(url, env('SUPABASE_ANON_KEY'), options);
  const other = createClient(url, env('SUPABASE_ANON_KEY'), options);
  const users: string[] = [];
  try {
    for (const client of [owner, other]) {
      const { data, error } = await client.auth.signUp({
        email: `management-${randomUUID()}@example.com`, password: 'Test-Management-123!',
      });
      assert.ifError(error);
      assert.ok(data.user);
      users.push(data.user.id);
      assert.ok(data.session);
    }
    const { data: defaults, error: seedError } = await owner.from('categories')
      .select('*').eq('is_custom', false).eq('type', 'expense').limit(1);
    assert.ifError(seedError);
    assert.ok(defaults?.length, 'New users receive default expense categories');
    const builtIn = defaults[0];
    const { data: accounts, error: accountError } = await owner.from('assets').insert(
      ['A', 'B', 'C'].map((name, sort_order) => ({
        name, type: 'bank', symbol: name, currency: 'EUR', sort_order,
        quantity: 0, purchase_price: 0, current_price: 0,
      })),
    ).select('id,name,sort_order');
    assert.ifError(accountError);
    assert.equal(accounts?.length, 3);
    assert.ok(accounts);
    const ids = accounts.sort((a, b) => a.sort_order - b.sort_order).map(a => a.id);
    const { data: transaction, error: transactionError } = await owner.from('transactions').insert({
      title: 'Management test expense', amount: 25, currency: 'EUR', exchange_rate: 1,
      type: 'expense', date: '2026-09-01', asset_id: ids[0], category_id: builtIn.id,
    }).select('id,category_id,amount').single();
    assert.ifError(transactionError);
    assert.ok(transaction);

    // Hiding a default excludes it from pickers but preserves the ledger relationship.
    assert.ifError((await owner.from('categories').update({ is_active: false }).eq('id', builtIn.id)).error);
    const hidden = await owner.from('categories').select('id').eq('id', builtIn.id).eq('is_active', true);
    assert.ifError(hidden.error);
    assert.deepEqual(hidden.data, []);
    const history = await owner.from('transactions').select('category_id,amount').eq('id', transaction.id).single();
    assert.ifError(history.error);
    assert.equal(history.data?.category_id, builtIn.id);
    assert.equal(history.data?.amount, 25);
    assert.ifError((await owner.from('categories').update({ is_active: true }).eq('id', builtIn.id)).error);
    const restored = await owner.from('categories').select('is_active,translation_key').eq('id', builtIn.id).single();
    assert.ifError(restored.error);
    assert.equal(restored.data?.is_active, true);
    assert.equal(restored.data?.translation_key, builtIn.translation_key);

    // A category created by the app is custom; its type/group/icon survive editing.
    const created = await owner.from('categories').insert({
      name: 'Test coffee', icon: '☕', type: 'expense', is_custom: true,
      translation_key: null, is_active: true, group_code: 'wants', color_code: '#F97316',
    }).select('id').single();
    assert.ifError(created.error);
    assert.ok(created.data);
    const categoryId = created.data.id;
    assert.ifError((await owner.from('categories').update({
      name: 'Test groceries', icon: '🛒', group_code: 'needs', color_code: '#4F46E5',
    }).eq('id', categoryId)).error);
    const edited = await owner.from('categories').select('name,icon,group_code,is_custom,translation_key').eq('id', categoryId).single();
    assert.ifError(edited.error);
    assert.deepEqual(edited.data, { name: 'Test groceries', icon: '🛒', group_code: 'needs', is_custom: true, translation_key: null });

    // Exercise the exact-count query used by the app's deletion guard; never delete a used category here.
    assert.ifError((await owner.from('transactions').update({ category_id: categoryId }).eq('id', transaction.id)).error);
    const used = await owner.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
    assert.ifError(used.error);
    assert.equal(used.count, 1);
    assert.ifError((await owner.from('transactions').update({ category_id: builtIn.id }).eq('id', transaction.id)).error);
    const unused = await owner.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
    assert.ifError(unused.error);
    assert.equal(unused.count, 0);
    assert.ifError((await owner.from('categories').delete().eq('id', categoryId)).error);
    const removed = await owner.from('categories').select('id').eq('id', categoryId);
    assert.ifError(removed.error);
    assert.deepEqual(removed.data, []);

    // Re-fetch with the same ordering as the mobile API after persistence.
    const reordered = [ids[2], ids[0], ids[1]];
    const writes = await Promise.all(reordered.map((id, sort_order) =>
      owner.from('assets').update({ sort_order }).eq('id', id)));
    writes.forEach(result => assert.ifError(result.error));
    const ordered = await owner.from('assets').select('id').in('id', ids)
      .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
    assert.ifError(ordered.error);
    assert.deepEqual(ordered.data?.map(a => a.id), reordered);

    // Another user cannot reorder or hide the owner's rows.
    assert.ifError((await other.from('assets').update({ sort_order: 99 }).eq('id', ids[2])).error);
    assert.ifError((await other.from('categories').update({ is_active: false }).eq('id', builtIn.id)).error);
    const unchanged = await owner.from('assets').select('sort_order').eq('id', ids[2]).single();
    assert.ifError(unchanged.error);
    assert.equal(unchanged.data?.sort_order, 0);
    const visible = await owner.from('categories').select('is_active').eq('id', builtIn.id).single();
    assert.ifError(visible.error);
    assert.equal(visible.data?.is_active, true);
    console.log('Management persistence passed: category create/edit/hide/restore, usage counts, unused delete, account order and tenant isolation. Native gesture and confirmation behavior are separate checks.');
  } finally {
    for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
