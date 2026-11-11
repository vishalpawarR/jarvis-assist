create table public.personal_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.tracked_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  url text not null check (char_length(url) <= 2048),
  hostname text not null check (char_length(hostname) between 1 and 253),
  favicon_url text,
  last_visited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.saved_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  url text not null check (char_length(url) <= 2048),
  selected_text text check (selected_text is null or char_length(selected_text) <= 5000),
  collection text not null default 'keep_forever'
    check (collection in ('read_later', 'keep_forever')),
  saved_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tracked_sites_user_updated_idx
  on public.tracked_sites (user_id, updated_at desc)
  where deleted_at is null;

create unique index tracked_sites_user_url_active_idx
  on public.tracked_sites (user_id, url)
  where deleted_at is null;

create index saved_pages_user_saved_idx
  on public.saved_pages (user_id, saved_at desc)
  where deleted_at is null;

alter table public.personal_details enable row level security;
alter table public.tracked_sites enable row level security;
alter table public.saved_pages enable row level security;

revoke all on table public.personal_details, public.tracked_sites, public.saved_pages
  from anon, authenticated;

grant select, insert, update, delete on table public.personal_details to authenticated;
grant select, insert, update, delete on table public.tracked_sites to authenticated;
grant select, insert, update, delete on table public.saved_pages to authenticated;

create policy "Users manage their own personal details"
  on public.personal_details
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own tracked sites"
  on public.tracked_sites
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own saved pages"
  on public.saved_pages
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
