create table public.sync_tombstones (
  user_id uuid not null references auth.users (id) on delete cascade,
  record_type text not null
    check (record_type in ('personal_details', 'tracked_sites', 'saved_pages')),
  record_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, record_type, record_id)
);

create index sync_tombstones_user_deleted_idx
  on public.sync_tombstones (user_id, deleted_at);

alter table public.sync_tombstones enable row level security;

revoke all on table public.sync_tombstones from anon, authenticated;
grant select on table public.sync_tombstones to authenticated;

create policy "Users read their own sync tombstones"
  on public.sync_tombstones
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.record_sync_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_record_id uuid;
begin
  if auth.uid() is null or auth.uid() <> old.user_id then
    return old;
  end if;

  if tg_table_name = 'personal_details' then
    deleted_record_id := old.user_id;
  else
    deleted_record_id := old.id;
  end if;

  insert into public.sync_tombstones (user_id, record_type, record_id)
  values (old.user_id, tg_table_name, deleted_record_id)
  on conflict (user_id, record_type, record_id)
  do update set deleted_at = excluded.deleted_at;

  return old;
end;
$$;

revoke all on function public.record_sync_tombstone()
  from public, anon, authenticated;

create trigger personal_details_sync_tombstone
  before delete on public.personal_details
  for each row execute function public.record_sync_tombstone();

create trigger tracked_sites_sync_tombstone
  before delete on public.tracked_sites
  for each row execute function public.record_sync_tombstone();

create trigger saved_pages_sync_tombstone
  before delete on public.saved_pages
  for each row execute function public.record_sync_tombstone();
