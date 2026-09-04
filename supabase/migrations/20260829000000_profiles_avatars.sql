-- Profile photos: a public `avatars` bucket plus a per-user `profiles` row.
--
-- Storage paths are `{user_id}/avatar.jpg` so a re-upload overwrites the same
-- object. `avatar_url` stores the public URL (with a cache-bust query) after
-- a successful upload. Auth `user_metadata.avatar_url` is updated in the same
-- client call so the session already has the URL without an extra fetch.
--
-- Safe to re-run: create table/index if not exists, drop/create policies,
-- insert bucket on conflict, backfill is idempotent.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. `avatar_url` is the public Storage URL for the profile photo.';

comment on column public.profiles.avatar_url is
  'Public URL of the object at avatars/{user_id}/avatar.jpg. Null until a photo is uploaded.';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
