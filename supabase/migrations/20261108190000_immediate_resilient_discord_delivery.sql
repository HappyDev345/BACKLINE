create or replace function security.queue_security_alert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
begin
  insert into public.security_alert_outbox (event_id)
  values (new.event_id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;
revoke all on function security.queue_security_alert() from public, anon, authenticated;

create or replace function security.wake_discord_security_alerts()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security, vault, net
as $$
declare
  project_url text;
  worker_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'backline_project_url';

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'discord_security_worker_secret';

  if project_url is null or worker_secret is null then
    raise warning 'Discord worker wake-up is not configured; scheduled delivery remains the fallback.';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/discord-security-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-security-worker-secret', worker_secret
    ),
    body := '{}'::jsonb
  );
  return new;
exception
  when others then
    raise warning 'Discord worker wake-up could not be queued; the alert remains in the outbox for scheduled delivery.';
    return new;
end;
$$;
revoke all on function security.wake_discord_security_alerts() from public, anon, authenticated, service_role;

drop trigger if exists wake_discord_security_alerts on public.security_alert_outbox;
create trigger wake_discord_security_alerts
  after insert on public.security_alert_outbox
  for each row execute function security.wake_discord_security_alerts();

drop function public.claim_security_alerts(integer);
create function public.claim_security_alerts(batch_size integer default 10)
returns table (
  event_id uuid,
  event_type text,
  outcome text,
  severity text,
  reason_code text,
  occurred_at timestamptz,
  actor_user_id uuid,
  target_type text,
  target_id uuid,
  attempt_count smallint,
  actor_display_name text,
  actor_username text,
  target_display_name text,
  target_username text,
  project_title text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  remaining_capacity integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the alert worker.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('backline-security-alert-dispatch', 0));

  update public.security_alert_outbox o
  set status = 'dead_letter',
      last_error_code = 'worker_timeout',
      updated_at = now()
  where o.status = 'sending'
    and o.attempt_count >= 5
    and o.updated_at <= now() - interval '5 minutes';

  select greatest(4 - count(*)::integer, 0) into remaining_capacity
  from public.security_alert_outbox o
  where o.last_attempt_at > now() - interval '2 seconds';
  if remaining_capacity = 0 then
    return;
  end if;

  return query
  with due as (
    select o.event_id
    from public.security_alert_outbox o
    where o.attempt_count < 5
      and (
        (o.status = 'pending' and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.updated_at <= now() - interval '5 minutes')
      )
    order by o.created_at
    for update skip locked
    limit least(greatest(coalesce(batch_size, 10), 1), 20, remaining_capacity)
  ),
  claimed as (
    update public.security_alert_outbox o
    set status = 'sending',
        attempt_count = o.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    from due
    where o.event_id = due.event_id
    returning o.event_id, o.attempt_count
  )
  select e.event_id, e.event_type, e.outcome, e.severity, e.reason_code,
    e.occurred_at, e.actor_user_id, e.target_type, e.target_id, claimed.attempt_count,
    e.metadata ->> 'actor_display_name',
    e.metadata ->> 'actor_username',
    e.metadata ->> 'target_display_name',
    e.metadata ->> 'target_username',
    e.metadata ->> 'project_title'
  from claimed
  join public.security_audit_events e on e.event_id = claimed.event_id;
end;
$$;
revoke all on function public.claim_security_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_security_alerts(integer) to service_role;

create or replace function public.security_alert_dispatch_state()
returns table (
  pending_alert_count bigint,
  due_alert_count bigint,
  wait_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  first_due_at timestamptz;
  recent_attempt_count integer;
  oldest_recent_attempt timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the alert worker.';
  end if;

  select count(*), count(*) filter (where o.next_attempt_at <= now()),
    min(o.next_attempt_at)
  into pending_alert_count, due_alert_count, first_due_at
  from public.security_alert_outbox o
  where o.status = 'pending' and o.attempt_count < 5;

  if pending_alert_count = 0 then
    return query select 0::bigint, 0::bigint, 0;
    return;
  end if;

  if due_alert_count = 0 then
    return query select pending_alert_count, due_alert_count,
      greatest(1, ceil(extract(epoch from first_due_at - now()))::integer);
    return;
  end if;

  select count(*)::integer, min(o.last_attempt_at)
  into recent_attempt_count, oldest_recent_attempt
  from public.security_alert_outbox o
  where o.last_attempt_at > now() - interval '2 seconds';

  if recent_attempt_count >= 4 then
    return query select pending_alert_count, due_alert_count,
      greatest(1, ceil(extract(epoch from oldest_recent_attempt + interval '2 seconds' - now()))::integer);
  else
    return query select pending_alert_count, due_alert_count, 1;
  end if;
end;
$$;
revoke all on function public.security_alert_dispatch_state() from public, anon, authenticated;
grant execute on function public.security_alert_dispatch_state() to service_role;

create or replace function public.complete_security_alert(
  event_uuid uuid,
  delivery_succeeded boolean,
  failure_code text,
  retry_after_seconds integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the alert worker.';
  end if;
  if failure_code is not null and failure_code !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'Invalid alert failure code.';
  end if;
  if retry_after_seconds is not null and retry_after_seconds not between 0 and 300 then
    raise exception 'Invalid retry delay.';
  end if;

  update public.security_alert_outbox o
  set status = case
        when delivery_succeeded then 'delivered'
        when o.attempt_count >= 5 then 'dead_letter'
        else 'pending'
      end,
      delivered_at = case when delivery_succeeded then now() else null end,
      next_attempt_at = case
        when delivery_succeeded or o.attempt_count >= 5 then o.next_attempt_at
        else now() + greatest(
          make_interval(secs => (30 * power(2, least(o.attempt_count - 1, 4)))::integer),
          make_interval(secs => coalesce(retry_after_seconds, 0))
        )
      end,
      last_error_code = case when delivery_succeeded then null else failure_code end,
      updated_at = now()
  where o.event_id = event_uuid and o.status = 'sending';

  if not found then
    raise exception 'The alert is not currently claimed by a worker.';
  end if;
end;
$$;
revoke all on function public.complete_security_alert(uuid, boolean, text, integer)
  from public, anon, authenticated;
grant execute on function public.complete_security_alert(uuid, boolean, text, integer)
  to service_role;

create or replace function public.complete_security_alert(
  event_uuid uuid,
  delivery_succeeded boolean,
  failure_code text default null
)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.complete_security_alert(event_uuid, delivery_succeeded, failure_code, null);
$$;
revoke all on function public.complete_security_alert(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.complete_security_alert(uuid, boolean, text)
  to service_role;

create or replace function security.purge_expired_security_events()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  deleted_count bigint;
begin
  delete from public.security_audit_events e
  where e.occurred_at < now() - interval '30 days'
    and not exists (
      select 1
      from public.security_alert_outbox o
      where o.event_id = e.event_id
        and o.status in ('pending', 'sending', 'dead_letter')
    );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function security.purge_expired_security_events() from public, anon, authenticated;
grant execute on function security.purge_expired_security_events() to service_role;

notify pgrst, 'reload schema';
