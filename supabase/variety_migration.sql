-- v2.0: Execute AFTER setup.sql and telegram_migration.sql, then varieties_seed.sql.
-- One canonical key per cultivar. No generic folder for new channel imports.
create table if not exists public.garden_varieties (
  variety_key text primary key check (variety_key ~ '^[a-z0-9_а-яёäüéöō]{1,100}$'),
  display_name text not null unique check (length(display_name) between 1 and 100)
);
alter table public.garden_varieties enable row level security;
grant select on public.garden_varieties to anon, authenticated;
create policy "read cultivar index" on public.garden_varieties for select to anon, authenticated using (true);

alter table public.telegram_gallery add column if not exists variety_key text
  references public.garden_varieties(variety_key);
alter table public.telegram_gallery add column if not exists variety_storage_path text
  generated always as (
    'Gortenzium/' || coalesce(variety_key || '/', '') || message_id::text || '.jpg'
  ) stored;
create index if not exists telegram_gallery_variety_idx
  on public.telegram_gallery(variety_key, created_at desc);
-- Pre-v2.0 unsorted messages retain NULL; the new Android client does not put them under a cultivar.

alter table public.garden_photos add column if not exists variety_key text
  references public.garden_varieties(variety_key);
create index if not exists garden_photos_variety_idx
  on public.garden_photos(variety_key, status, created_at desc);
-- Prevent NEW app uploads without a valid cultivar; legacy records remain unchanged.
drop policy if exists "gallery: create own pending, max 10 per 24h" on public.garden_photos;
create policy "gallery: create own pending for named variety" on public.garden_photos
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and status = 'pending'
    and variety_key is not null
    and exists (select 1 from public.garden_varieties v where v.variety_key = garden_photos.variety_key)
    and (select count(*) from public.garden_photos mine
      where mine.owner_id = (select auth.uid()) and mine.created_at > now() - interval '24 hours') < 10
  );
