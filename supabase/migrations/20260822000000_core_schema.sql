-- Budgree core schema baseline.
--
-- Captured from the hosted production schema on 2026-09-04 using only
-- information_schema and pg_catalog metadata. This file deliberately contains
-- the columns and constraints that pre-date the incremental migrations which
-- follow it. `if not exists` keeps it safe to register against the existing
-- hosted database, where these tables were originally created in the Dashboard.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text not null,
  quantity numeric not null,
  purchase_price numeric not null,
  current_price numeric,
  currency text not null default 'EUR',
  created_at timestamptz not null default timezone('utc', now()),
  type text,
  icon text,
  custom_color text,
  sort_order integer,
  constraint assets_type_check check (
    type is null
    or type in ('stock', 'etf', 'crypto', 'commodity', 'cash', 'card', 'bank')
  )
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  icon text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null,
  currency text not null default 'EUR',
  type text not null,
  category_id uuid references public.categories (id) on delete set null,
  date date not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  asset_id uuid not null references public.assets (id) on delete set null,
  exchange_rate numeric not null default 1,
  constraint transactions_type_check check (type in ('income', 'expense')),
  constraint transactions_currency_not_blank check (
    currency is not null and length(trim(currency)) > 0
  ),
  constraint transactions_exchange_rate_positive check (exchange_rate > 0)
);

create index if not exists transactions_asset_id_idx
  on public.transactions (asset_id);
