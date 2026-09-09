-- User-selected reporting currency for Dashboard and Analytics totals.
--
-- Historical transactions remain immutable: their `exchange_rate` still
-- converts the original amount into canonical EUR. The profile rate converts
-- only those canonical aggregates into the user's chosen display currency.

alter table public.profiles
  add column if not exists reporting_currency text not null default 'EUR',
  add column if not exists reporting_exchange_rate numeric not null default 1,
  add column if not exists reporting_rate_updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_reporting_currency_check'
  ) then
    alter table public.profiles
      add constraint profiles_reporting_currency_check
      check (reporting_currency in ('EUR', 'USD', 'GBP', 'TRY'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_reporting_exchange_rate_check'
  ) then
    alter table public.profiles
      add constraint profiles_reporting_exchange_rate_check
      check (reporting_exchange_rate > 0);
  end if;
end;
$$;

comment on column public.profiles.reporting_currency is
  'Currency used to display canonical EUR totals across Dashboard and Analytics.';

comment on column public.profiles.reporting_exchange_rate is
  'Latest persisted multiplier from canonical EUR into reporting_currency.';

comment on column public.profiles.reporting_rate_updated_at is
  'Timestamp of the persisted reporting exchange rate; supports later refresh policies.';
