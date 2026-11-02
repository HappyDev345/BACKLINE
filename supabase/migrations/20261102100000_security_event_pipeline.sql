create schema if not exists security;
revoke all on schema security from public, anon, authenticated, service_role;

create table if not exists security.configuration (
  singleton boolean primary key default true check (singleton),
  audit_enabled boolean not null default false,
  message_limit_per_minute smallint not null default 30
    check (message_limit_per_minute between 1 and 600)
);
insert into security.configuration (singleton)
values (true)
on conflict (singleton) do nothing;
revoke all on security.configuration from public, anon, authenticated, service_role;

create table if not exists public.security_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  event_version smallint not null default 1 check (event_version = 1),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  outcome text not null check (outcome in ('allowed', 'denied', 'failed', 'flagged', 'accepted', 'rejected', 'completed')),
  reason_code text check (reason_code is null or reason_code ~ '^[a-z0-9_]{1,64}$'),
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  actor_user_id uuid,
  target_type text check (target_type is null or target_type ~ '^[a-z][a-z0-9_]{0,31}$'),
  target_id uuid,
  request_id uuid,
  source text not null check (source in ('postgres-trigger', 'supabase-edge-function')),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 1024
      and not (metadata ?| array[
        'body', 'message_body', 'password', 'token', 'cookie', 'authorization',
        'filename', 'details', 'source_ip', 'device_id'
      ])
    ),
  created_at timestamptz not null default now()
);

create index if not exists security_audit_events_recent
  on public.security_audit_events (occurred_at desc);
create index if not exists security_audit_events_type_recent
  on public.security_audit_events (event_type, occurred_at desc);
create index if not exists security_audit_events_actor_recent
  on public.security_audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from public, anon, authenticated, service_role;
grant select on public.security_audit_events to authenticated;
create policy "admins read security audit events"
  on public.security_audit_events for select
  using (public.current_user_has_role('admin'));

create or replace function security.write_event(
  p_event_type text,
  p_outcome text,
  p_severity text,
  p_reason_code text,
  p_actor_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_source text default 'postgres-trigger'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  event_uuid uuid;
  safe_metadata jsonb := '{}'::jsonb;
  byte_size_text text;
begin
  if not coalesce((select c.audit_enabled from security.configuration c where c.singleton), false) then
    return null;
  end if;

  if p_event_type like 'upload.%' then
    byte_size_text := p_metadata ->> 'byte_size';
    safe_metadata := jsonb_build_object(
      'media_type', left(nullif(p_metadata ->> 'media_type', ''), 32),
      'byte_size', case
        when byte_size_text ~ '^[0-9]{1,8}$' then byte_size_text::integer
        else null
      end
    );
  end if;

  insert into public.security_audit_events (
    event_type, outcome, severity, reason_code, actor_user_id,
    target_type, target_id, source, metadata
  )
  values (
    p_event_type, p_outcome, p_severity, p_reason_code, p_actor_user_id,
    p_target_type, p_target_id, p_source, safe_metadata
  )
  returning event_id into event_uuid;

  return event_uuid;
end;
$$;
revoke all on function security.write_event(text, text, text, text, uuid, text, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

create or replace function security.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  row_data jsonb;
  previous_data jsonb;
  actor_uuid uuid;
  target_uuid uuid;
  event_name text;
  event_result text := 'completed';
  severity_level text := 'medium';
  reason text;
  resource_type text;
  repeated_message_count bigint;
begin
  row_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  previous_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;

  if tg_table_name = 'reports' then
    resource_type := 'report';
    target_uuid := coalesce((row_data ->> 'id')::uuid, (previous_data ->> 'id')::uuid);
    if tg_op = 'INSERT' then
      event_name := 'report.created';
      event_result := 'accepted';
      actor_uuid := (row_data ->> 'reporter_id')::uuid;
      reason := row_data ->> 'reason';
    elsif row_data ->> 'status' = 'in_review'
      and previous_data ->> 'status' is distinct from 'in_review' then
      event_name := 'report.claimed';
      actor_uuid := (row_data ->> 'reviewer_id')::uuid;
      reason := 'claimed';
    elsif row_data ->> 'status' in ('actioned', 'dismissed')
      and previous_data ->> 'status' is distinct from row_data ->> 'status' then
      event_name := 'report.resolved';
      actor_uuid := (row_data ->> 'reviewer_id')::uuid;
      reason := row_data ->> 'status';
    end if;
  elsif tg_table_name = 'messages' and tg_op = 'INSERT' then
    event_name := 'message.created';
    event_result := 'accepted';
    actor_uuid := (row_data ->> 'sender_id')::uuid;
    resource_type := 'message';
    target_uuid := (row_data ->> 'id')::uuid;
    reason := 'submitted';
    if coalesce((select c.audit_enabled from security.configuration c where c.singleton), false) then
      select count(*) into repeated_message_count
      from public.messages m
      where m.sender_id = actor_uuid
        and m.body = (row_data ->> 'body')
        and m.created_at > now() - interval '1 minute';
      if repeated_message_count = 3 then
        perform security.write_event(
          'message.risk_flagged', 'flagged', 'medium', 'repeated_message_burst',
          actor_uuid, 'message', target_uuid, '{}'::jsonb, 'postgres-trigger'
        );
      end if;
    end if;
  elsif tg_table_name = 'moderation_actions' and tg_op = 'INSERT' then
    event_name := 'moderation.action_applied';
    actor_uuid := (row_data ->> 'actor_id')::uuid;
    resource_type := row_data ->> 'target_type';
    target_uuid := (row_data ->> 'target_id')::uuid;
    reason := row_data ->> 'action';
  elsif tg_table_name = 'staff_roles' then
    event_name := case when tg_op = 'INSERT' then 'staff.role_granted' else 'staff.role_revoked' end;
    event_result := case when tg_op = 'INSERT' then 'accepted' else 'completed' end;
    actor_uuid := auth.uid();
    resource_type := 'account';
    target_uuid := coalesce((row_data ->> 'user_id')::uuid, (previous_data ->> 'user_id')::uuid);
    reason := coalesce(row_data ->> 'role', previous_data ->> 'role');
    severity_level := 'high';
  elsif tg_table_name = 'account_restrictions'
    and (
      (tg_op = 'INSERT' and (row_data ->> 'suspended')::boolean)
      or (tg_op = 'UPDATE' and row_data ->> 'suspended' is distinct from previous_data ->> 'suspended')
    ) then
    if coalesce((row_data ->> 'suspended')::boolean, false) then
      event_name := 'account.suspended';
      reason := 'suspended';
    else
      event_name := 'account.reinstated';
      reason := 'reinstated';
    end if;
    event_result := 'completed';
    actor_uuid := (row_data ->> 'updated_by')::uuid;
    resource_type := 'account';
    target_uuid := (row_data ->> 'user_id')::uuid;
    severity_level := 'high';
  elsif tg_table_name = 'staff_notes' and tg_op = 'INSERT' then
    event_name := 'staff.note_added';
    actor_uuid := (row_data ->> 'author_id')::uuid;
    resource_type := 'report';
    target_uuid := (row_data ->> 'report_id')::uuid;
    reason := 'case_note_added';
  end if;

  if event_name is not null then
    perform security.write_event(
      event_name, event_result, severity_level, reason, actor_uuid,
      resource_type, target_uuid, '{}'::jsonb, 'postgres-trigger'
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function security.audit_row_change() from public, anon, authenticated;

drop trigger if exists audit_reports on public.reports;
create trigger audit_reports
  after insert or update on public.reports
  for each row execute function security.audit_row_change();
drop trigger if exists audit_messages on public.messages;
create trigger audit_messages
  after insert on public.messages
  for each row execute function security.audit_row_change();
drop trigger if exists audit_moderation_actions on public.moderation_actions;
create trigger audit_moderation_actions
  after insert on public.moderation_actions
  for each row execute function security.audit_row_change();
drop trigger if exists audit_staff_roles on public.staff_roles;
create trigger audit_staff_roles
  after insert or delete on public.staff_roles
  for each row execute function security.audit_row_change();
drop trigger if exists audit_account_restrictions on public.account_restrictions;
create trigger audit_account_restrictions
  after insert or update on public.account_restrictions
  for each row execute function security.audit_row_change();
drop trigger if exists audit_staff_notes on public.staff_notes;
create trigger audit_staff_notes
  after insert on public.staff_notes
  for each row execute function security.audit_row_change();

create or replace function security.audit_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
begin
  if tg_op = 'INSERT' then
    perform security.write_event(
      'account.created', 'accepted', 'info', 'signup', null,
      'account', new.id, '{}'::jsonb, 'postgres-trigger'
    );
    return new;
  end if;

  perform security.write_event(
    'account.deleted', 'completed', 'high', 'account_deletion', auth.uid(),
    'account', old.id, '{}'::jsonb, 'postgres-trigger'
  );
  return old;
end;
$$;
revoke all on function security.audit_auth_user_change() from public, anon, authenticated;
drop trigger if exists audit_auth_user_changes on auth.users;
create trigger audit_auth_user_changes
  after insert or delete on auth.users
  for each row execute function security.audit_auth_user_change();

create or replace function security.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  per_minute_limit smallint;
  recent_messages bigint;
begin
  new.created_at := clock_timestamp();

  if new.sender_id is null or auth.uid() is null or new.sender_id <> auth.uid() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text, 0));
  select c.message_limit_per_minute into per_minute_limit
  from security.configuration c
  where c.singleton;

  select count(*) into recent_messages
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at > now() - interval '1 minute';

  if recent_messages >= per_minute_limit then
    raise exception using
      errcode = 'P0001',
      message = 'You are sending messages too quickly. Please wait a moment.';
  end if;

  return new;
end;
$$;
revoke all on function security.enforce_message_rate_limit() from public, anon, authenticated;
create index if not exists messages_sender_recent
  on public.messages (sender_id, created_at desc);
drop trigger if exists enforce_message_rate_limit on public.messages;
create trigger enforce_message_rate_limit
  before insert on public.messages
  for each row execute function security.enforce_message_rate_limit();

create or replace function public.get_reported_message(report_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  message_uuid uuid;
  message_context jsonb;
begin
  if not public.can_moderate_target('message') then
    raise exception 'Only admins can review reported private messages.';
  end if;

  select r.target_id into message_uuid
  from public.reports r
  where r.id = report_uuid and r.target_type = 'message';
  if message_uuid is null then
    raise exception 'That message report could not be found.';
  end if;

  perform security.write_event(
    'staff.evidence_viewed', 'completed', 'high', 'reported_message',
    auth.uid(), 'message', message_uuid, '{}'::jsonb, 'postgres-trigger'
  );

  select jsonb_build_object(
    'id', m.id,
    'body', m.body,
    'sender_id', m.sender_id,
    'created_at', m.created_at,
    'profiles', jsonb_build_object('display_name', p.display_name)
  )
  into message_context
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  where m.id = message_uuid;

  return message_context;
end;
$$;
revoke all on function public.get_reported_message(uuid) from public;
grant execute on function public.get_reported_message(uuid) to authenticated;
