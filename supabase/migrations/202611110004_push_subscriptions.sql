create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) between 1 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  daily_checkins_enabled boolean not null default true,
  daily_checkin_time time not null default '09:00',
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 100),
  last_sent_local_date date,
  claimed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_due_idx
  on public.push_subscriptions (daily_checkin_time, timezone)
  where daily_checkins_enabled;

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, daily_checkins_enabled, daily_checkin_time, timezone)
  on table public.push_subscriptions to authenticated;
grant update (user_id, endpoint, p256dh, auth, daily_checkins_enabled, daily_checkin_time, timezone)
  on table public.push_subscriptions to authenticated;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_push_subscription_updated_at()
  from public, anon, authenticated;

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_push_subscription_updated_at();
