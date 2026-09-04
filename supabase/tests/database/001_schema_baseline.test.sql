begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select ok(to_regclass('public.assets') is not null, 'assets table exists');
select ok(to_regclass('public.categories') is not null, 'categories table exists');
select ok(to_regclass('public.transactions') is not null, 'transactions table exists');
select ok(to_regclass('public.profiles') is not null, 'profiles table exists');

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'user_id'
  ),
  'transactions has an owner column'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'to_asset_id'
  ),
  'transactions has a transfer destination'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'billing_month'
  ),
  'transactions has a billing month snapshot'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'group_code'
  ),
  'categories has a budget group'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assets' and column_name = 'statement_day'
  ),
  'assets has a credit statement cutoff'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assets' and column_name = 'asset_class'
  ),
  'obsolete account-level asset_class is absent'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assets' and column_name = 'ticker'
  ),
  'obsolete account-level ticker is absent'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.assets'::regclass),
  true,
  'assets has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  true,
  'categories has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
  true,
  'transactions has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles has RLS enabled'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('assets', 'categories', 'transactions', 'profiles')
  ),
  15::bigint,
  'all private-table CRUD policies exist'
);
select is(
  (
    select count(*)
    from pg_constraint con
    join pg_class relation on relation.oid = con.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'transactions'
  ),
  11::bigint,
  'transaction integrity constraints match the hosted schema'
);
select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('assets', 'categories', 'transactions', 'profiles')
  ),
  12::bigint,
  'core indexes match the hosted schema'
);

select * from finish();
rollback;
