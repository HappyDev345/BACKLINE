create table if not exists public.security_alert_outbox (
  event_id uuid primary key references public.security_audit_events(event_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'delivered', 'dead_letter')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists security_alert_outbox_pending
  on public.security_alert_outbox (next_attempt_at, created_at)
  where status in ('pending', 'sending');

alter table public.security_alert_outbox enable row level security;
revoke all on public.security_alert_outbox from public, anon, authenticated, service_role;

create or replace function security.queue_security_alert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
begin
  if new.event_type in (
    'report.created',
    'staff.role_granted',
    'staff.role_revoked',
    'account.suspended',
    'account.reinstated',
    'upload.rejected',
    'upload.failed'
  ) then
    insert into public.security_alert_outbox (event_id)
    values (new.event_id)
    on conflict (event_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function security.queue_security_alert() from public, anon, authenticated;
drop trigger if exists queue_security_alert on public.security_audit_events;
create trigger queue_security_alert
  after insert on public.security_audit_events
  for each row execute function security.queue_security_alert();

create or replace function public.claim_security_alerts(batch_size integer default 10)
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
  attempt_count smallint
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

  select greatest(10 - count(*)::integer, 0) into remaining_capacity
  from public.security_alert_outbox o
  where o.last_attempt_at > now() - interval '1 minute';
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
    e.occurred_at, e.actor_user_id, e.target_type, e.target_id, claimed.attempt_count
  from claimed
  join public.security_audit_events e on e.event_id = claimed.event_id;
end;
$$;
revoke all on function public.claim_security_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_security_alerts(integer) to service_role;

create or replace function public.complete_security_alert(
  event_uuid uuid,
  delivery_succeeded boolean,
  failure_code text default null
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

  update public.security_alert_outbox o
  set status = case
        when delivery_succeeded then 'delivered'
        when o.attempt_count >= 5 then 'dead_letter'
        else 'pending'
      end,
      delivered_at = case when delivery_succeeded then now() else null end,
      next_attempt_at = case
        when delivery_succeeded or o.attempt_count >= 5 then o.next_attempt_at
        else now() + make_interval(secs => (30 * power(2, least(o.attempt_count - 1, 4)))::integer)
      end,
      last_error_code = case when delivery_succeeded then null else failure_code end,
      updated_at = now()
  where o.event_id = event_uuid and o.status = 'sending';

  if not found then
    raise exception 'The alert is not currently claimed by a worker.';
  end if;
end;
$$;
revoke all on function public.complete_security_alert(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_security_alert(uuid, boolean, text) to service_role;
