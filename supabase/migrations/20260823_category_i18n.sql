-- Category internationalization.
--
-- Default categories stop storing a display name to translate at read time —
-- `translation_key` points at the app's `categories.*` i18n keys instead, so
-- the same row reads as "Market" in English, "Market" in Turkish, "Boodschappen"
-- in Dutch, or "Supermercado" in Spanish, purely based on the device locale.
-- `is_custom` is the switch: false means "look up translation_key", true means
-- "show `name` exactly as the user typed it". `name` itself keeps the English
-- canonical value for every default row, since chart colors and the Gemini
-- prompt both key off it (`categoryPalette.ts`, `ai.ts`) — only the on-screen
-- label changes with locale, never the value stored or matched against.
--
-- Safe to re-run: existing rows are matched by (name, type) and upgraded in
-- place, so historical transactions keep pointing at the same category id.
-- Any of the 23 defaults that don't exist yet are inserted fresh.
--
-- Run it in the Supabase SQL editor, or `supabase db push`.

alter table public.categories
  add column if not exists is_custom boolean not null default false;

alter table public.categories
  add column if not exists translation_key text;

comment on column public.categories.is_custom is
  'False for the app''s built-in categories (name resolved via translation_key). True once a user creates or edits one.';
comment on column public.categories.translation_key is
  'i18n key under "categories.*", e.g. categories.category_market. Null for custom categories.';

create temporary table _default_categories (
  name text,
  type text,
  translation_key text,
  icon text
) on commit drop;

insert into _default_categories (name, type, translation_key, icon) values
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

-- Upgrade any of these categories the user already has, matched by name so
-- their id — and every transaction pointing at it — never changes.
-- `::text` on the left guards against `type` being an enum rather than plain
-- text in the live schema — a harmless no-op cast if it's already text.
update public.categories c
set is_custom = false,
    translation_key = d.translation_key
from _default_categories d
where lower(c.name) = lower(d.name)
  and c.type::text = d.type;

-- Seed whichever defaults are still missing entirely.
insert into public.categories (name, type, icon, is_custom, translation_key)
select d.name, d.type, d.icon, false, d.translation_key
from _default_categories d
where not exists (
  select 1
  from public.categories c
  where lower(c.name) = lower(d.name)
    and c.type::text = d.type
);
