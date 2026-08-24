-- Soft-delete support for categories.
--
-- Deleting a built-in category used to hard-delete the row — destructive,
-- and impossible to undo from the UI (see the "Water" incident: the user had
-- to be patched back in by hand via SQL). From now on:
--   - Custom categories (`is_custom = true`) still hard-delete, same as today.
--   - Default categories (`is_custom = false`) are soft-deleted: hidden via
--     `is_active = false` instead of removed, so they can be restored with a
--     tap and every transaction that already points at them stays valid.
--
-- Safe to re-run: `add column if not exists` is a no-op once applied.

alter table public.categories
  add column if not exists is_active boolean not null default true;

comment on column public.categories.is_active is
  'False hides a category from pickers and the AI without deleting it — used to soft-delete defaults. Restorable any time.';
