begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001', 'rls-a@budgree.test', '{}'),
  ('b0000000-0000-4000-8000-000000000002', 'rls-b@budgree.test', '{}');

insert into public.assets (
  id, name, symbol, type, quantity, purchase_price, current_price, currency, user_id
)
values
  ('a1000000-0000-4000-8000-000000000001', 'A Account', 'EUR', 'bank', 0, 0, 0, 'EUR', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'B Account', 'EUR', 'bank', 0, 0, 0, 'EUR', 'b0000000-0000-4000-8000-000000000002');

insert into public.categories (
  id, name, type, icon, is_custom, is_active, group_code, color_code, user_id
)
values
  ('a3000000-0000-4000-8000-000000000001', 'A Custom', 'expense', '🅰️', true, true, 'wants', '#AA0000', 'a0000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000002', 'B Custom', 'expense', '🅱️', true, true, 'wants', '#0000BB', 'b0000000-0000-4000-8000-000000000002');

insert into public.transactions (
  id, title, amount, currency, exchange_rate, type, category_id, asset_id, date, user_id
)
select
  'a2000000-0000-4000-8000-000000000001', 'A Income', 100, 'EUR', 1, 'income', c.id,
  'a1000000-0000-4000-8000-000000000001', '2026-01-01', 'a0000000-0000-4000-8000-000000000001'
from public.categories c
where c.user_id = 'a0000000-0000-4000-8000-000000000001'
  and c.translation_key = 'category_salary'
limit 1;

insert into public.transactions (
  id, title, amount, currency, exchange_rate, type, category_id, asset_id, date, user_id
)
select
  'b2000000-0000-4000-8000-000000000002', 'B Income', 200, 'EUR', 1, 'income', c.id,
  'b1000000-0000-4000-8000-000000000002', '2026-01-01', 'b0000000-0000-4000-8000-000000000002'
from public.categories c
where c.user_id = 'b0000000-0000-4000-8000-000000000002'
  and c.translation_key = 'category_salary'
limit 1;

set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*) from public.assets), 1::bigint, 'user A sees only their account');
select is((select count(*) from public.categories), 31::bigint, 'user A sees only their categories');
select is((select count(*) from public.transactions), 1::bigint, 'user A sees only their transaction');
select is((select count(*) from public.profiles), 1::bigint, 'user A sees only their profile');

select lives_ok(
  $$insert into public.assets (id, name, symbol, type, quantity, purchase_price, current_price, currency)
    values ('a1000000-0000-4000-8000-000000000003', 'A Savings', 'EUR', 'bank', 0, 0, 0, 'EUR')$$,
  'user A can create an owned account using the auth.uid default'
);

select throws_ok(
  $$insert into public.assets (id, name, symbol, type, quantity, purchase_price, current_price, currency, user_id)
    values ('a1000000-0000-4000-8000-000000000004', 'Forged', 'EUR', 'bank', 0, 0, 0, 'EUR', 'b0000000-0000-4000-8000-000000000002')$$,
  '42501'
);

select is(
  (with changed as (
    update public.assets set name = 'Compromised'
    where id = 'b1000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'user A cannot update user B account'
);

select is(
  (with removed as (
    delete from public.assets
    where id = 'b1000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'user A cannot delete user B account'
);

select throws_ok(
  $$insert into public.transactions
      (id, title, amount, currency, exchange_rate, type, asset_id, date)
    values
      ('a2000000-0000-4000-8000-000000000003', 'Foreign source', 10, 'EUR', 1, 'income',
       'b1000000-0000-4000-8000-000000000002', '2026-01-02')$$,
  '42501'
);

select throws_ok(
  $$insert into public.transactions
      (id, title, amount, currency, exchange_rate, type, category_id, asset_id, date)
    values
      ('a2000000-0000-4000-8000-000000000004', 'Foreign category', 10, 'EUR', 1, 'expense',
       'b3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '2026-01-02')$$,
  '42501'
);

select throws_ok(
  $$insert into public.transactions
      (id, title, amount, currency, exchange_rate, type, asset_id, to_asset_id, date)
    values
      ('a2000000-0000-4000-8000-000000000005', 'Foreign destination', 10, 'EUR', 1, 'transfer',
       'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '2026-01-02')$$,
  '42501'
);

select lives_ok(
  $$insert into public.transactions
      (id, title, amount, currency, exchange_rate, type, asset_id, date)
    values
      ('a2000000-0000-4000-8000-000000000006', 'Owned transaction', 10, 'EUR', 1, 'income',
       'a1000000-0000-4000-8000-000000000001', '2026-01-02')$$,
  'user A can create a transaction against their account'
);

select throws_ok(
  $$select public.seed_default_categories('b0000000-0000-4000-8000-000000000002')$$,
  '42501'
);

set local "request.jwt.claim.sub" = 'b0000000-0000-4000-8000-000000000002';

select is((select count(*) from public.assets), 1::bigint, 'user B sees only their account');
select is((select count(*) from public.categories), 31::bigint, 'user B sees only their categories');
select is((select count(*) from public.transactions), 1::bigint, 'user B sees only their transaction');
select is((select count(*) from public.profiles), 1::bigint, 'user B sees only their profile');

set local role anon;
set local "request.jwt.claim.sub" = 'a0000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role" = 'anon';

select is((select count(*) from public.assets), 0::bigint, 'anon cannot read accounts even with a forged sub');
select is((select count(*) from public.profiles), 0::bigint, 'anon cannot read profiles even with a forged sub');

select * from finish();
rollback;
