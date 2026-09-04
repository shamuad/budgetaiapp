-- Deterministic, non-personal local development data.
--
-- This placeholder Auth row has no password and cannot sign in. Create a
-- login-capable local user through Studio when manual auth testing is needed.
-- The insert fires the production signup triggers, proving that profile and
-- default-category provisioning also work during a clean reset.

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001',
  'demo@budgree.test',
  '{"seed": true}'::jsonb
)
on conflict (id) do nothing;

insert into public.assets (
  id,
  name,
  symbol,
  type,
  icon,
  quantity,
  purchase_price,
  current_price,
  currency,
  sort_order,
  user_id
)
values (
  '20000000-0000-4000-8000-000000000001',
  'Demo Checking',
  'EUR',
  'bank',
  '🏦',
  0,
  0,
  0,
  'EUR',
  0,
  '10000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.transactions (
  id,
  title,
  amount,
  currency,
  exchange_rate,
  type,
  category_id,
  asset_id,
  date,
  user_id
)
select
  '30000000-0000-4000-8000-000000000001',
  'Demo Income',
  2500,
  'EUR',
  1,
  'income',
  c.id,
  '20000000-0000-4000-8000-000000000001',
  '2026-01-01',
  '10000000-0000-4000-8000-000000000001'
from public.categories c
where c.user_id = '10000000-0000-4000-8000-000000000001'
  and c.translation_key = 'category_salary'
limit 1
on conflict (id) do nothing;
