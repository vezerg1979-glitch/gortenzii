-- v2.1: Run AFTER setup.sql, telegram_migration.sql, variety_migration.sql, varieties_seed.sql.
-- Exact, administrator-confirmed mapping of forum CHAT + TOPIC ID -> ONE catalog variety.
-- Admin-only writes via Supabase service_role; public read only for topic links and approved photos.
create table if not exists public.gortenzium_topics (
  chat_id bigint not null check (chat_id < -1000000000000),
  message_thread_id bigint not null check (message_thread_id > 1),
  variety_key text not null references public.garden_varieties(variety_key),
  topic_title text not null default '' check (char_length(topic_title) <= 128),
  bound_at timestamptz not null default now(),
  primary key (chat_id, message_thread_id),
  unique (chat_id, variety_key)
);
alter table public.gortenzium_topics enable row level security;
grant select on public.gortenzium_topics to anon, authenticated;
drop policy if exists "read forum topic mappings" on public.gortenzium_topics;
create policy "read forum topic mappings" on public.gortenzium_topics
  for select to anon, authenticated using (true);

create table if not exists public.telegram_topic_gallery (
  chat_id bigint not null,
  message_id bigint not null check (message_id > 0),
  message_thread_id bigint not null,
  variety_key text not null references public.garden_varieties(variety_key),
  caption text not null default '' check (char_length(caption) <= 180),
  created_at timestamptz not null,
  variety_storage_path text generated always as (
    'Gortenzium/topics/' || variety_key || '/' || message_id::text || '.jpg'
  ) stored,
  primary key (chat_id, message_id),
  foreign key (chat_id, message_thread_id) references public.gortenzium_topics(chat_id, message_thread_id)
);
create index if not exists telegram_topic_gallery_by_variety_idx
  on public.telegram_topic_gallery(variety_key, created_at desc);
alter table public.telegram_topic_gallery enable row level security;
grant select on public.telegram_topic_gallery to anon, authenticated;
drop policy if exists "read approved forum photos" on public.telegram_topic_gallery;
create policy "read approved forum photos" on public.telegram_topic_gallery
  for select to anon, authenticated using (true);
-- No user/client INSERT, UPDATE or DELETE policies. Never expose service_role to Android.
