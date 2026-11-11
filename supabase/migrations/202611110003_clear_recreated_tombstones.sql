create function public.clear_recreated_sync_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id_to_clear uuid;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    return new;
  end if;

  if tg_table_name = 'personal_details' then
    record_id_to_clear := new.user_id;
  else
    record_id_to_clear := new.id;
  end if;

  delete from public.sync_tombstones
  where user_id = new.user_id
    and record_type = tg_table_name
    and record_id = record_id_to_clear;

  return new;
end;
$$;

revoke all on function public.clear_recreated_sync_tombstone()
  from public, anon, authenticated;

create trigger personal_details_clear_sync_tombstone
  after insert or update on public.personal_details
  for each row execute function public.clear_recreated_sync_tombstone();

create trigger tracked_sites_clear_sync_tombstone
  after insert or update on public.tracked_sites
  for each row execute function public.clear_recreated_sync_tombstone();

create trigger saved_pages_clear_sync_tombstone
  after insert or update on public.saved_pages
  for each row execute function public.clear_recreated_sync_tombstone();
