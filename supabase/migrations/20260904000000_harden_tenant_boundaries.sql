-- Harden tenant boundaries after the initial owner-only RLS migration.
--
-- A transaction belongs to a user, but its account/category foreign keys also
-- need to belong to that same user. Without these checks, a client which knew
-- another user's UUID could create an otherwise-owned transaction pointing at
-- the other user's account or category. The read policy would not reveal the
-- parent row, but the database would still accept a cross-tenant relationship.

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.assets a
      where a.id = transactions.asset_id
        and a.user_id = (select auth.uid())
    )
    and (
      transactions.category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = transactions.category_id
          and c.user_id = (select auth.uid())
      )
    )
    and (
      transactions.to_asset_id is null
      or exists (
        select 1 from public.assets destination
        where destination.id = transactions.to_asset_id
          and destination.user_id = (select auth.uid())
      )
    )
  );

create policy "transactions_update_own"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.assets a
      where a.id = transactions.asset_id
        and a.user_id = (select auth.uid())
    )
    and (
      transactions.category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = transactions.category_id
          and c.user_id = (select auth.uid())
      )
    )
    and (
      transactions.to_asset_id is null
      or exists (
        select 1 from public.assets destination
        where destination.id = transactions.to_asset_id
          and destination.user_id = (select auth.uid())
      )
    )
  );

create policy "transactions_delete_own"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Make the role scope explicit on the remaining private tables too. An anon
-- token should have no applicable policy even if it supplies a forged `sub`
-- claim in a local test environment.
drop policy if exists "assets_select_own" on public.assets;
drop policy if exists "assets_insert_own" on public.assets;
drop policy if exists "assets_update_own" on public.assets;
drop policy if exists "assets_delete_own" on public.assets;

create policy "assets_select_own" on public.assets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "assets_insert_own" on public.assets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "assets_update_own" on public.assets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "assets_delete_own" on public.assets
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- These SECURITY DEFINER routines exist only for internal trigger execution.
-- PostgreSQL grants EXECUTE to PUBLIC by default, which would let a client seed
-- categories for arbitrary user IDs unless it is explicitly revoked.
revoke execute on function public.seed_default_categories(uuid)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.handle_new_profile()
  from public, anon, authenticated;
