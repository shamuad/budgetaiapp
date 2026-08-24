-- Fix-up for 20260823_category_i18n.sql.
--
-- That migration tagged default categories by matching their English
-- canonical name (e.g. "Salary"). This project's `categories` table already
-- had Turkish-named legacy defaults from before the i18n system existed
-- (e.g. "Maaş", "Yemek & Kafe") — those never matched, so they kept
-- `translation_key = null`, AND a duplicate English-named row got inserted
-- alongside each one with zero transactions attached. Net effect: no visible
-- change for anyone using the app in Turkish, plus duplicate-looking
-- categories in Manage Categories.
--
-- This migration:
--   1. Tags each known legacy row with its `translation_key` in place —
--      keeping its id, so every transaction that already points at it is
--      untouched and instantly starts following the device language.
--   2. Moves any transactions off the now-redundant canonical duplicate onto
--      the legacy row, then deletes the empty duplicate so it stops cluttering
--      the category list.
--   3. Repairs any default category a user deleted and then manually
--      recreated by hand from Manage Categories — that lands as a brand-new
--      `is_custom = true` row with whatever icon happened to be selected, not
--      the original one. Any such row whose name still matches one of the 23
--      built-in categories exactly gets re-linked to its `translation_key`
--      and has its correct icon restored.
--
-- Safe to re-run: every step only touches rows that still need it, so running
-- this again once everything is already fixed is a harmless no-op.

create temporary table _legacy_category_aliases (
  legacy_name text,
  type text,
  translation_key text,
  canonical_name text
) on commit drop;

insert into _legacy_category_aliases (legacy_name, type, translation_key, canonical_name) values
  ('Maaş', 'income', 'category_salary', 'Salary'),
  ('Diğer', 'income', 'category_other_income', 'Other Income'),
  ('Yemek & Kafe', 'expense', 'category_eat_drink', 'Eat and Drink'),
  ('Eğlence', 'expense', 'category_entertainment', 'Entertainment'),
  ('Ulaşım & Araç', 'expense', 'category_transportation', 'Transportation');

-- Step 1: tag the legacy row in place.
update public.categories legacy
set translation_key = a.translation_key
from _legacy_category_aliases a
where legacy.name = a.legacy_name
  and legacy.type::text = a.type
  and legacy.is_custom = false;

-- Step 2: re-point transactions off the redundant canonical duplicate, then
-- drop it, for every alias that actually has one.
do $$
declare
  a record;
  legacy_id uuid;
  dup_id uuid;
begin
  for a in select * from _legacy_category_aliases loop
    select id into legacy_id from public.categories
      where name = a.legacy_name and type::text = a.type
      limit 1;

    select id into dup_id from public.categories
      where name = a.canonical_name and type::text = a.type and id <> legacy_id
      limit 1;

    if legacy_id is not null and dup_id is not null then
      update public.transactions set category_id = legacy_id where category_id = dup_id;
      delete from public.categories where id = dup_id;
    end if;
  end loop;
end $$;

-- Step 3: repair hand-recreated defaults (see "Water" — restores its
-- translation_key and its 🚰 icon, same list as 20260823_category_i18n.sql).
create temporary table _default_categories_repair (
  name text,
  type text,
  translation_key text,
  icon text
) on commit drop;

insert into _default_categories_repair (name, type, translation_key, icon) values
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
  ('Subscriptions', 'expense', 'category_subscriptions', '📺');

update public.categories c
set is_custom = false,
    translation_key = d.translation_key,
    icon = d.icon
from _default_categories_repair d
where c.is_custom = true
  and lower(c.name) = lower(d.name)
  and c.type::text = d.type;
