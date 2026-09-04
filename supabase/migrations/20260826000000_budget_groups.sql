-- 50/30/20 budget grouping for expense categories.
--
-- Adds two columns to `categories`:
--   - `group_code`: 'needs' | 'wants' | null. Deliberately excludes 'savings' —
--     money moved to savings/investment accounts is recorded as a `transfer`
--     (see `transactions_transfer_shape_check`), never as an expense category,
--     so the 50/30/20 Savings bucket is computed from transfers at query time
--     (see `calculateBudgetBreakdown` in packages/shared) rather than stored
--     here. The check constraint below makes that impossible to violate.
--   - `color_code`: a hex string driving the picker/management screen colors.
--     `getCategoryColor` in categoryPalette.ts prefers this and only falls
--     back to its old name-hash logic for rows that don't have one (custom
--     categories, income categories).
--
-- Retires the old 18-category expense list in favor of the 25 specific,
-- industry-standard line items in `budget_categories.md`, split 14 Needs /
-- 11 Wants. Twelve of the eighteen are matched onto their new leaf in place
-- (same id, so every historical transaction keeps pointing at the same row;
-- eleven of those twelve also get a new name, `Mortgage` keeps its own);
-- thirteen new leaf categories are added; six have no equivalent in the new
-- list and are soft-deactivated via the existing `is_active` mechanism
-- (20260824_category_soft_delete.sql) rather than deleted, so they stay
-- restorable and every past transaction that used them keeps working.
--
-- Safe to re-run: columns are `add column if not exists`, renames are matched
-- by the OLD name so re-running is a no-op once applied, and new rows are
-- inserted only `where not exists`.

alter table public.categories
  add column if not exists group_code text;

alter table public.categories
  add column if not exists color_code text;

alter table public.categories
  drop constraint if exists categories_group_code_check;
alter table public.categories
  add constraint categories_group_code_check
  check (group_code is null or group_code in ('needs', 'wants'));

alter table public.categories
  drop constraint if exists categories_color_code_check;
alter table public.categories
  add constraint categories_color_code_check
  check (color_code is null or color_code ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.categories.group_code is
  '50/30/20 budget tier for an expense category: needs or wants. Always null for income. Never "savings" — see migration header.';
comment on column public.categories.color_code is
  'Hex color for pickers/charts. Null falls back to categoryPalette.ts''s name-hash color (custom categories, income).';

-- 1. Rename 12 existing expense categories onto their new leaf-level name,
--    matched by the OLD name so this is safe to re-run. `translation_key`
--    moves too; the OLD key is dropped from every locale file in this change
--    (see packages/shared/i18n/locales/*.ts) since nothing points at it anymore.
update public.categories set
  name = 'Electricity', translation_key = 'category_electricity',
  group_code = 'needs', color_code = '#3B82F6'
where type = 'expense' and lower(name) = 'energy';

update public.categories set
  name = 'Water & Gas', translation_key = 'category_water_gas',
  group_code = 'needs', color_code = '#0EA5E9'
where type = 'expense' and lower(name) = 'water';

update public.categories set
  name = 'Internet & Phone', translation_key = 'category_internet_phone',
  group_code = 'needs', color_code = '#0284C7'
where type = 'expense' and lower(name) = 'telecom';

update public.categories set
  name = 'Fuel', translation_key = 'category_fuel',
  group_code = 'needs', color_code = '#2563EB'
where type = 'expense' and lower(name) = 'transportation';

update public.categories set
  name = 'Car Insurance & Maintenance', translation_key = 'category_car_insurance_maintenance',
  group_code = 'needs', color_code = '#312E81'
where type = 'expense' and lower(name) = 'car & insurance';

update public.categories set
  name = 'Food Groceries', translation_key = 'category_food_groceries',
  group_code = 'needs', color_code = '#60A5FA'
where type = 'expense' and lower(name) = 'market';

-- Mortgage keeps its name — it already matches the document's leaf exactly.
update public.categories set
  group_code = 'needs', color_code = '#4F46E5'
where type = 'expense' and lower(name) = 'mortgage';

update public.categories set
  name = 'Restaurants & Cafes', translation_key = 'category_restaurants_cafes',
  group_code = 'wants', color_code = '#FB923C'
where type = 'expense' and lower(name) = 'eat and drink';

update public.categories set
  name = 'Movies, Concerts & Events', translation_key = 'category_movies_concerts_events',
  group_code = 'wants', color_code = '#F97316'
where type = 'expense' and lower(name) = 'entertainment';

update public.categories set
  name = 'Streaming', translation_key = 'category_streaming',
  group_code = 'wants', color_code = '#FBBF24'
where type = 'expense' and lower(name) = 'subscriptions';

update public.categories set
  name = 'Clothing & Shoes', translation_key = 'category_clothing_shoes',
  group_code = 'wants', color_code = '#FCD34D'
where type = 'expense' and lower(name) = 'clothing';

update public.categories set
  name = 'Personal Care & Cosmetics', translation_key = 'category_personal_care_cosmetics',
  group_code = 'wants', color_code = '#FDE68A'
where type = 'expense' and lower(name) = 'personal needs';

-- 2. Six categories with no equivalent leaf in the new list are retired, not
--    deleted: hidden from pickers and the AI, restorable any time, and every
--    past transaction that used one keeps reading it back correctly.
update public.categories set is_active = false
where type = 'expense'
  and lower(name) in ('home needs', 'house cleaning', 'education', 'gift', 'bank commission', 'municipality');

-- 3. Thirteen new leaf categories, one row per existing user (mirrors the
--    per-user ownership model from 20260825_row_level_security.sql). An
--    inline VALUES list rather than a temp table, so this stays a single
--    statement regardless of whether the migration runner wraps the whole
--    file in one transaction or applies it statement-by-statement. Each
--    insert is idempotent: skipped for any user who already has that
--    translation_key.
insert into public.categories (name, type, icon, is_custom, translation_key, is_active, group_code, color_code, user_id)
select d.name, 'expense', d.icon, false, d.translation_key, true, d.group_code, d.color_code, u.id
from auth.users u
cross join (
  values
    -- Needs
    ('Rent', '🏘️', 'needs', '#6366F1', 'category_rent_expense'),
    ('HOA Fees', '🏢', 'needs', '#4338CA', 'category_hoa_fees'),
    ('Public Transit', '🚌', 'needs', '#1D4ED8', 'category_public_transit'),
    ('Pharmacies & Medicine', '💊', 'needs', '#0369A1', 'category_pharmacies_medicine'),
    ('Health Insurance', '🏥', 'needs', '#1E40AF', 'category_health_insurance'),
    ('Credit Card Minimums', '💳', 'needs', '#3730A3', 'category_credit_card_minimums'),
    ('Loan Repayments', '💸', 'needs', '#818CF8', 'category_loan_repayments'),
    -- Wants
    ('Fast Food & Coffee', '☕', 'wants', '#FDBA74', 'category_fast_food_coffee'),
    ('Nightlife & Socializing', '🎉', 'wants', '#EA580C', 'category_nightlife_socializing'),
    ('Gym Memberships', '🏋️', 'wants', '#F59E0B', 'category_gym_memberships'),
    ('Gadgets & Accessories', '🎧', 'wants', '#D97706', 'category_gadgets_accessories'),
    ('Flights & Hotels', '✈️', 'wants', '#C2410C', 'category_flights_hotels'),
    ('Hobby Materials', '🎨', 'wants', '#B45309', 'category_hobby_materials')
) as d (name, icon, group_code, color_code, translation_key)
where not exists (
  select 1
  from public.categories c
  where c.user_id = u.id
    and c.type = 'expense'
    and c.translation_key = d.translation_key
);

-- 4. Update the signup seed function so every future user gets the full,
--    correctly-grouped 25-leaf expense list plus the 5 unchanged income
--    categories directly, without depending on this file's one-off backfill.
create or replace function public.seed_default_categories(target_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (name, type, icon, is_custom, translation_key, is_active, group_code, color_code, user_id)
  select d.name, d.type, d.icon, false, d.translation_key, true, d.group_code, d.color_code, target_user
  from (
    values
      -- Income — unchanged, no budget group.
      ('Salary', 'income', 'category_salary', '💼', null, null),
      ('Rent', 'income', 'category_rent', '🏠', null, null),
      ('Child Benefit', 'income', 'category_child_benefit', '👶', null, null),
      ('Interest', 'income', 'category_interest', '📈', null, null),
      ('Other Income', 'income', 'category_other_income', '💰', null, null),
      -- Needs (14)
      ('Rent', 'expense', 'category_rent_expense', '🏘️', 'needs', '#6366F1'),
      ('Mortgage', 'expense', 'category_mortgage', '🏦', 'needs', '#4F46E5'),
      ('HOA Fees', 'expense', 'category_hoa_fees', '🏢', 'needs', '#4338CA'),
      ('Electricity', 'expense', 'category_electricity', '💡', 'needs', '#3B82F6'),
      ('Water & Gas', 'expense', 'category_water_gas', '🚰', 'needs', '#0EA5E9'),
      ('Internet & Phone', 'expense', 'category_internet_phone', '📶', 'needs', '#0284C7'),
      ('Fuel', 'expense', 'category_fuel', '⛽', 'needs', '#2563EB'),
      ('Public Transit', 'expense', 'category_public_transit', '🚌', 'needs', '#1D4ED8'),
      ('Car Insurance & Maintenance', 'expense', 'category_car_insurance_maintenance', '🚗', 'needs', '#312E81'),
      ('Food Groceries', 'expense', 'category_food_groceries', '🛒', 'needs', '#60A5FA'),
      ('Pharmacies & Medicine', 'expense', 'category_pharmacies_medicine', '💊', 'needs', '#0369A1'),
      ('Health Insurance', 'expense', 'category_health_insurance', '🏥', 'needs', '#1E40AF'),
      ('Credit Card Minimums', 'expense', 'category_credit_card_minimums', '💳', 'needs', '#3730A3'),
      ('Loan Repayments', 'expense', 'category_loan_repayments', '💸', 'needs', '#818CF8'),
      -- Wants (11)
      ('Restaurants & Cafes', 'expense', 'category_restaurants_cafes', '🍽️', 'wants', '#FB923C'),
      ('Fast Food & Coffee', 'expense', 'category_fast_food_coffee', '☕', 'wants', '#FDBA74'),
      ('Movies, Concerts & Events', 'expense', 'category_movies_concerts_events', '🎬', 'wants', '#F97316'),
      ('Nightlife & Socializing', 'expense', 'category_nightlife_socializing', '🎉', 'wants', '#EA580C'),
      ('Streaming', 'expense', 'category_streaming', '📺', 'wants', '#FBBF24'),
      ('Gym Memberships', 'expense', 'category_gym_memberships', '🏋️', 'wants', '#F59E0B'),
      ('Clothing & Shoes', 'expense', 'category_clothing_shoes', '👕', 'wants', '#FCD34D'),
      ('Gadgets & Accessories', 'expense', 'category_gadgets_accessories', '🎧', 'wants', '#D97706'),
      ('Personal Care & Cosmetics', 'expense', 'category_personal_care_cosmetics', '💄', 'wants', '#FDE68A'),
      ('Flights & Hotels', 'expense', 'category_flights_hotels', '✈️', 'wants', '#C2410C'),
      ('Hobby Materials', 'expense', 'category_hobby_materials', '🎨', 'wants', '#B45309')
  ) as d (name, type, translation_key, icon, group_code, color_code)
  where not exists (
    select 1
    from public.categories c
    where c.user_id = target_user
      and lower(c.name) = lower(d.name)
      and c.type::text = d.type
  );
$$;
