create function public.validate_push_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  endpoint_host text;
begin
  endpoint_host := lower(split_part(split_part(new.endpoint, '://', 2), '/', 1));
  if endpoint_host not in (
    'fcm.googleapis.com',
    'web.push.apple.com',
    'push.services.mozilla.com',
    'notify.windows.com'
  )
    and endpoint_host not like '%.push.services.mozilla.com'
    and endpoint_host not like '%.notify.windows.com'
  then
    raise exception 'Unsupported web push endpoint host'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'Invalid push notification time zone'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_push_subscription()
  from public, anon, authenticated;

create trigger push_subscriptions_validate
  before insert or update of endpoint, timezone on public.push_subscriptions
  for each row execute function public.validate_push_subscription();

create function public.claim_due_push_subscriptions(p_limit integer default 100)
returns table (
  id uuid,
  endpoint text,
  p256dh text,
  auth text,
  send_for_date date
)
language sql
security definer
set search_path = ''
as $$
  with current_clock as (
    select now() as current_at
  ),
  due_subscriptions as materialized (
    select
      subscription.id,
      (clock.current_at at time zone subscription.timezone)::date as send_for_date
    from public.push_subscriptions as subscription
    cross join current_clock as clock
    where subscription.daily_checkins_enabled
      and (clock.current_at at time zone subscription.timezone)::time
        >= subscription.daily_checkin_time
      and subscription.last_sent_local_date is distinct from
        (clock.current_at at time zone subscription.timezone)::date
      and (
        subscription.claimed_until is null
        or subscription.claimed_until <= clock.current_at
      )
    order by subscription.created_at
    limit least(greatest(coalesce(p_limit, 1), 1), 100)
    for update of subscription skip locked
  )
  update public.push_subscriptions as subscription
  set claimed_until = now() + interval '10 minutes'
  from due_subscriptions
  where subscription.id = due_subscriptions.id
  returning
    subscription.id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    due_subscriptions.send_for_date;
$$;

create function public.complete_push_delivery(
  p_subscription_id uuid,
  p_send_for_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_subscriptions
  set
    last_sent_local_date = p_send_for_date,
    claimed_until = null
  where id = p_subscription_id
    and claimed_until is not null;

  return found;
end;
$$;

create function public.defer_push_delivery_claim(p_subscription_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_subscriptions
  set claimed_until = now() + interval '15 minutes'
  where id = p_subscription_id
    and claimed_until is not null;

  return found;
end;
$$;

revoke all on function public.claim_due_push_subscriptions(integer)
  from public, anon, authenticated;
revoke all on function public.complete_push_delivery(uuid, date)
  from public, anon, authenticated;
revoke all on function public.defer_push_delivery_claim(uuid)
  from public, anon, authenticated;

grant execute on function public.claim_due_push_subscriptions(integer) to service_role;
grant execute on function public.complete_push_delivery(uuid, date) to service_role;
grant execute on function public.defer_push_delivery_claim(uuid) to service_role;
grant delete on table public.push_subscriptions to service_role;
