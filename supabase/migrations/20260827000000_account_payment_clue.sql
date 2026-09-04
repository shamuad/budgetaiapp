-- Payment clue for receipt scanning.
--
-- Accounts are rows in `assets` (see 20260823_investment_accounts_and_transfers.sql),
-- so the column lands there.
--
-- The receipt scanner has to work out which account paid from what the till
-- printed near the total: "VISA 1234", "489495xxxxxx0718", "MASTERCARD ****5678",
-- "NAKIT", "PayPal". Until now the only thing it could match against was the
-- account name, which pushed users toward naming an account "ING Visa 0718"
-- just to make scanning work — display name doing double duty as matching key.
--
-- `payment_clue` separates the two: the name stays whatever the user wants to
-- read on their dashboard, and this holds the fragment that identifies the
-- account on a receipt. Nullable, because an account that is never scanned
-- against does not need one.
--
-- Safe to re-run: `add column if not exists`, and the comment is idempotent.

alter table public.assets
  add column if not exists payment_clue varchar(64);

comment on column public.assets.payment_clue is
  'Optional fragment printed on receipts that identifies this account, e.g. "0718", "VISA", "PayPal". Fed to the receipt scanner to match a payment line onto an account.';
