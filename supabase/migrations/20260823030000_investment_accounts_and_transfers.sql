-- Wealth management: investment accounts and double-entry transfers.
--
-- The app's Supabase schema is not generated from this repo, so run this once in
-- the Supabase SQL editor (or via `supabase db push`) before shipping the client
-- changes. Every statement is written to be safe to re-run.

-- 1. `transactions.type` must accept 'transfer'.
--    The column may be a text column guarded by a check constraint, or a Postgres
--    enum, depending on how the table was first created. Handle both.
do $$
declare
  column_udt text;
  existing_constraint record;
begin
  select udt_name
    into column_udt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transactions'
    and column_name = 'type';

  if column_udt in ('text', 'varchar', 'bpchar') then
    -- Drop any check constraint that currently pins `type` to two values.
    for existing_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public.transactions'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%type%'
    loop
      execute format(
        'alter table public.transactions drop constraint %I',
        existing_constraint.conname
      );
    end loop;

    alter table public.transactions
      add constraint transactions_type_check
      check (type in ('income', 'expense', 'transfer'));
  else
    -- Enum-backed column: widen the enum in place.
    execute format('alter type %I add value if not exists ''transfer''', column_udt);
  end if;
end $$;

-- 2. Transfer and investment columns on the ledger.
alter table public.transactions
  add column if not exists to_asset_id uuid references public.assets (id),
  add column if not exists shares numeric,
  add column if not exists unit_price numeric;

comment on column public.transactions.to_asset_id is
  'Credited account of a transfer. Null for income and expense.';
comment on column public.transactions.shares is
  'Units acquired when a transfer buys into an investment account.';
comment on column public.transactions.unit_price is
  'Price paid per unit, in the row''s own currency.';

-- Transfers carry no category, so the column has to allow nulls.
alter table public.transactions
  alter column category_id drop not null;

-- Filtering and joining by the receiving account.
create index if not exists transactions_to_asset_id_idx
  on public.transactions (to_asset_id);

-- 3. Bookkeeping integrity: a transfer names a destination and no category, and
--    never lands back on the account it left. Income and expense keep the old shape.
alter table public.transactions
  drop constraint if exists transactions_transfer_shape_check;

alter table public.transactions
  add constraint transactions_transfer_shape_check check (
    case
      when type = 'transfer'
        then to_asset_id is not null
          and to_asset_id <> asset_id
          and category_id is null
      else to_asset_id is null
    end
  );

-- 4. Investment metadata on accounts.
alter table public.assets
  add column if not exists asset_class text,
  add column if not exists ticker text;

alter table public.assets
  drop constraint if exists assets_asset_class_check;

alter table public.assets
  add constraint assets_asset_class_check check (
    asset_class is null
    or asset_class in ('etf', 'stock', 'fund', 'bond', 'crypto', 'commodity')
  );

comment on column public.assets.asset_class is
  'Refines an investment account: what the holding actually is.';
comment on column public.assets.ticker is
  'Market ticker of an investment holding, e.g. VUSA.AS.';

-- 5. `assets.type` must accept 'investment' as an account kind.
do $$
declare
  column_udt text;
  existing_constraint record;
begin
  select udt_name
    into column_udt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'assets'
    and column_name = 'type';

  if column_udt in ('text', 'varchar', 'bpchar') then
    for existing_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public.assets'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%type%'
    loop
      execute format(
        'alter table public.assets drop constraint %I',
        existing_constraint.conname
      );
    end loop;

    alter table public.assets
      add constraint assets_type_check
      check (
        type is null
        or type in ('stock', 'etf', 'crypto', 'commodity', 'cash', 'card', 'bank', 'investment')
      );
  else
    execute format('alter type %I add value if not exists ''investment''', column_udt);
  end if;
end $$;
