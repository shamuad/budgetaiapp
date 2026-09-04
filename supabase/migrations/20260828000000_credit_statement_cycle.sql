-- Credit card statement cycle.
--
-- Accounts are rows in `assets`. `type = 'card'` is only the vessel (debit or
-- credit); `is_credit` is the facility flag. `statement_day` is the inclusive
-- cutoff (1–28) used to bucket a purchase into a billing month.
--
-- `transactions.billing_month` is a snapshot taken at write time (first of the
-- statement month) so changing `statement_day` later does not rewrite history.
-- Null on cash/debit/bank rows and on transfers — paying a card is a transfer,
-- not statement spending.
--
-- Safe to re-run: add column if not exists, drop/add named checks, create index
-- if not exists. The backfill is idempotent (`billing_month is null`).

alter table public.assets
  add column if not exists is_credit boolean not null default false,
  add column if not exists statement_day smallint;

alter table public.assets
  drop constraint if exists assets_credit_statement_check;

alter table public.assets
  add constraint assets_credit_statement_check check (
    (is_credit = false and statement_day is null)
    or (is_credit = true and type = 'card' and statement_day between 1 and 28)
  );

comment on column public.assets.is_credit is
  'Credit facility. Only valid when type is card. Debit cards stay false.';

comment on column public.assets.statement_day is
  'Inclusive cutoff day of the month (1–28). Purchases on or before this day belong to this month''s statement; later purchases belong to the next. Null unless is_credit.';

alter table public.transactions
  add column if not exists billing_month date;

alter table public.transactions
  drop constraint if exists transactions_billing_month_first_of_month_check;

alter table public.transactions
  add constraint transactions_billing_month_first_of_month_check check (
    billing_month is null
    or billing_month = date_trunc('month', billing_month)::date
  );

comment on column public.transactions.billing_month is
  'First day of the statement month this income/expense belongs to. Set at write time for is_credit accounts. Null for cash/debit and for transfers.';

create index if not exists transactions_billing_month_idx
  on public.transactions (billing_month)
  where billing_month is not null;

-- Best-effort: existing card income/expense rows get the calendar month of
-- their purchase date. Historical statement_day is unknown, so this matches
-- today's analytics (month of `date`) until the user saves with a real cutoff.
update public.transactions as t
set billing_month = date_trunc('month', t.date::date)::date
from public.assets as a
where t.asset_id = a.id
  and a.type = 'card'
  and t.type in ('income', 'expense')
  and t.billing_month is null;
