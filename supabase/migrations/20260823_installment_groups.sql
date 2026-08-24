-- Installment plans.
--
-- Buying something "in 6 installments" writes six ordinary transactions, one
-- per month, each carrying an equal (rounding-adjusted) slice of the total.
-- `installment_group_id` is the only thing that ties them back together, so
-- editing or deleting one can offer to act on the whole plan.
--
-- Run it in the Supabase SQL editor, or `supabase db push`.

alter table public.transactions
  add column if not exists installment_group_id uuid;

comment on column public.transactions.installment_group_id is
  'Shared by every row an installment plan was split into. Null for a one-off transaction.';

-- Cascade delete looks up every row in a plan by this id.
create index if not exists transactions_installment_group_idx
  on public.transactions (installment_group_id)
  where installment_group_id is not null;
