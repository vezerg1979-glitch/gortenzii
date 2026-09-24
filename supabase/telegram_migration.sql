-- Run ONCE, after supabase/setup.sql. Channel posts are public only if channel moderators
-- explicitly add #в_альбом to the caption; ordinary app photos remain in a private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gortenzium-channel', 'gortenzium-channel', true, 5000000, array['image/jpeg'])
on conflict (id) do nothing;

create table if not exists public.telegram_gallery (
  message_id bigint primary key check (message_id > 0),
  caption text not null default '' check (char_length(caption) <= 180),
  created_at timestamptz not null,
  storage_path text generated always as ('Gortenzium/' || message_id::text || '.jpg') stored
);
create index if not exists telegram_gallery_newest_idx on public.telegram_gallery(created_at desc);
alter table public.telegram_gallery enable row level security;
grant select on public.telegram_gallery to anon, authenticated;
-- Only the server with a secret key/service_role can insert, update or delete.
create policy "read approved channel photos" on public.telegram_gallery
  for select to anon, authenticated using (true);
-- Don't create public client insert, update, or delete policies for this table or bucket.
