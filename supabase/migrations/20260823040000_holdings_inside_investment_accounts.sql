-- Two-tier investment model.
--
-- Tier one is the account: a bank, a card, or a brokerage. Tier two is the
-- holding, which now lives on the transaction that bought it rather than
-- masquerading as its own account. An S&P 500 ETF is therefore a symbol on a
-- transfer into a brokerage account, not an account in its own right.
--
-- Safe to run whether or not 20260823_investment_accounts_and_transfers.sql has
-- already been applied. Run it in the Supabase SQL editor, or `supabase db push`.

-- 1. The holding a transfer bought, inside the destination account.
alter table public.transactions
  add column if not exists asset_symbol text;

comment on column public.transactions.asset_symbol is
  'Market symbol of the holding bought by this transfer, e.g. VUSA.AS or BTC.';

-- Reporting groups a holding by symbol within its destination account.
create index if not exists transactions_holding_idx
  on public.transactions (to_asset_id, asset_symbol)
  where asset_symbol is not null;

-- 2. A symbol only means something on a transfer into an investment account,
--    and an empty string is not a symbol.
alter table public.transactions
  drop constraint if exists transactions_asset_symbol_shape_check;

alter table public.transactions
  add constraint transactions_asset_symbol_shape_check check (
    asset_symbol is null
    or (type = 'transfer' and length(btrim(asset_symbol)) > 0)
  );

-- 3. Accounts no longer describe a single holding, so the columns that assumed
--    one account per asset go away. Nothing ever wrote to them.
alter table public.assets
  drop constraint if exists assets_asset_class_check;

alter table public.assets
  drop column if exists asset_class,
  drop column if exists ticker;
