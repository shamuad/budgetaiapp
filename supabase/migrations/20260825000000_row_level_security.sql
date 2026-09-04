-- Row Level Security: isolate every user's financial data.
--
-- Until now, `transactions`, `assets`, and `categories` had no owner column,
-- so every signed-in user read and wrote the exact same rows. This migration
-- makes each row belong to exactly one `auth.users` row and turns on RLS so
-- Postgres itself refuses cross-user access, regardless of what the client
-- asks for.
--
-- `categories` needs one extra step. Today it holds 23 shared "default" rows
-- (`is_custom = false`, seeded once by 20260823_category_i18n.sql) that every
-- user reads from a single copy. A plain `user_id = auth.uid()` policy would
-- make those rows invisible to everyone and break hide/restore
-- (20260824_category_soft_delete.sql), which toggles `is_active` on exactly
-- those rows. So instead of special-casing "global" rows in every policy,
-- each user gets their own private copy of the 23 defaults — seeded
-- automatically on signup by a trigger, and backfilled below for anyone who
-- already has an account. That keeps one uniform, fully-owned RLS policy
-- across all three tables, and every existing feature (rename, hide/restore,
-- reset icon) keeps working exactly as before, just scoped per user.
--
-- Rows written before Supabase Auth existed have no way to know who they
-- belong to, so `user_id` stays nullable and those old rows are left with
-- `user_id is null` — invisible under RLS to every user, including their
-- original creator. If you need to reclaim old dev/test data, run e.g.:
--   update public.transactions set user_id = '<your-user-id>' where user_id is null;
--   update public.assets set user_id = '<your-user-id>' where user_id is null;
-- before (or after) applying this file.
--
-- Safe to re-run: every statement is `if not exists` / `or replace` /
-- `drop ... if exists` first. Run it in the Supabase SQL editor, or
-- `supabase db push`.

-- 1. Ownership column on every user-owned table.
alter table public.transactions
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid();

alter table public.assets
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid();

alter table public.categories
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid();

comment on column public.transactions.user_id is
  'Owning user, defaulted to auth.uid() on insert. Null on rows written before Auth existed — invisible under RLS until manually backfilled.';
comment on column public.assets.user_id is
  'Owning user, defaulted to auth.uid() on insert. Null on rows written before Auth existed — invisible under RLS until manually backfilled.';
comment on column public.categories.user_id is
  'Owning user. Every account gets its own copy of the 23 defaults (see seed_default_categories/handle_new_user below) plus whatever custom categories it adds.';

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists assets_user_id_idx on public.assets (user_id);
create index if not exists categories_user_id_idx on public.categories (user_id);

-- 2. Give every user their own copy of the default categories, so RLS can
--    treat categories exactly like transactions and assets: fully owned, no
--    "global row" exception. `security definer` lets this insert succeed
--    even though it runs from a trigger with no end-user session.
create or replace function public.seed_default_categories(target_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (name, type, icon, is_custom, translation_key, is_active, user_id)
  select d.name, d.type, d.icon, false, d.translation_key, true, target_user
  from (
    values
      ('Salary', 'income', 'category_salary', '💼'),
      ('Rent', 'income', 'category_rent', '🏠'),
      ('Child Benefit', 'income', 'category_child_benefit', '👶'),
      ('Interest', 'income', 'category_interest', '📈'),
      ('Other Income', 'income', 'category_other_income', '💰'),
      ('Mortgage', 'expense', 'category_mortgage', '🏦'),
      ('Energy', 'expense', 'category_energy', '💡'),
      ('Water', 'expense', 'category_water', '🚰'),
      ('Transportation', 'expense', 'category_transportation', '🚗'),
      ('Market', 'expense', 'category_market', '🛒'),
      ('Eat and Drink', 'expense', 'category_eat_drink', '🍔'),
      ('Clothing', 'expense', 'category_clothing', '👕'),
      ('Home Needs', 'expense', 'category_home_needs', '🏠'),
      ('House Cleaning', 'expense', 'category_house_cleaning', '🧹'),
      ('Education', 'expense', 'category_education', '🎓'),
      ('Entertainment', 'expense', 'category_entertainment', '🎬'),
      ('Personal Needs', 'expense', 'category_personal_needs', '🧴'),
      ('Gift', 'expense', 'category_gift', '🎁'),
      ('Bank Commission', 'expense', 'category_bank_commission', '🏧'),
      ('Telecom', 'expense', 'category_telecom', '📱'),
      ('Car & Insurance', 'expense', 'category_car_insurance', '🚙'),
      ('Municipality', 'expense', 'category_municipality', '🏛️'),
      ('Subscriptions', 'expense', 'category_subscriptions', '📺')
  ) as d (name, type, translation_key, icon)
  where not exists (
    select 1
    from public.categories c
    where c.user_id = target_user
      and lower(c.name) = lower(d.name)
      and c.type::text = d.type
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: anyone who signed up before this migration ran still needs their
-- own copy of the defaults. Idempotent — `seed_default_categories` only
-- inserts what that user doesn't already have.
do $$
declare
  existing_user record;
begin
  for existing_user in select id from auth.users loop
    perform public.seed_default_categories(existing_user.id);
  end loop;
end $$;

-- 3. Turn on RLS and lock every operation to the row's own user_id. Identical
--    shape on all three tables now that categories are fully owned too.
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.categories enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

drop policy if exists "assets_select_own" on public.assets;
drop policy if exists "assets_insert_own" on public.assets;
drop policy if exists "assets_update_own" on public.assets;
drop policy if exists "assets_delete_own" on public.assets;

create policy "assets_select_own" on public.assets
  for select using (auth.uid() = user_id);
create policy "assets_insert_own" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "assets_update_own" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = user_id);

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);
