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
  safe_metadata jsonb;
  byte_size_text text;
  actor_display_name text;
  actor_username text;
  target_display_name text;
  target_username text;
begin
  if not coalesce((select c.audit_enabled from security.configuration c where c.singleton), false) then
    return null;
  end if;

  if p_actor_user_id is not null then
    select p.display_name, p.username
      into actor_display_name, actor_username
    from public.profiles p
    where p.id = p_actor_user_id;
  end if;
  if p_target_type = 'account' and p_target_id is not null then
    select p.display_name, p.username
      into target_display_name, target_username
    from public.profiles p
    where p.id = p_target_id;
  end if;

  safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'actor_display_name', left(
      nullif(regexp_replace(coalesce(actor_display_name, ''), '[[:cntrl:]]', ' ', 'g'), ''), 40
    ),
    'actor_username', left(
      nullif(regexp_replace(coalesce(actor_username, ''), '[[:cntrl:]]', ' ', 'g'), ''), 24
    ),
    'target_display_name', left(
      nullif(regexp_replace(coalesce(target_display_name, ''), '[[:cntrl:]]', ' ', 'g'), ''), 40
    ),
    'target_username', left(
      nullif(regexp_replace(coalesce(target_username, ''), '[[:cntrl:]]', ' ', 'g'), ''), 24
    )
  ));

  if p_event_type like 'upload.%' then
    byte_size_text := p_metadata ->> 'byte_size';
    safe_metadata := safe_metadata || jsonb_strip_nulls(jsonb_build_object(
      'media_type', left(nullif(p_metadata ->> 'media_type', ''), 32),
      'byte_size', case
        when byte_size_text ~ '^[0-9]{1,8}$' then byte_size_text::integer
        else null
      end
    ));
  elsif p_event_type like 'project.%' then
    safe_metadata := safe_metadata || jsonb_strip_nulls(jsonb_build_object(
      'project_title',
      left(
        nullif(regexp_replace(coalesce(p_metadata ->> 'project_title', ''), '[[:cntrl:]]', ' ', 'g'), ''),
        100
      )
    ));
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

create or replace function security.audit_content_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  row_data jsonb;
  previous_data jsonb;
  event_action text;
  event_name text;
  resource_type text;
  actor_uuid uuid;
  target_uuid uuid;
  event_metadata jsonb := '{}'::jsonb;
begin
  row_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  previous_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  event_action := case tg_op
    when 'INSERT' then 'created'
    when 'UPDATE' then 'updated'
    when 'DELETE' then 'deleted'
  end;
  target_uuid := coalesce((row_data ->> 'id')::uuid, (previous_data ->> 'id')::uuid);

  if tg_table_name = 'projects' then
    event_name := 'project.' || event_action;
    resource_type := 'project';
    actor_uuid := coalesce((row_data ->> 'creator_id')::uuid, (previous_data ->> 'creator_id')::uuid);
    event_metadata := jsonb_build_object(
      'project_title',
      coalesce(row_data ->> 'title', previous_data ->> 'title')
    );
  elsif tg_table_name = 'posts' then
    resource_type := case
      when coalesce(row_data ->> 'category', previous_data ->> 'category') is null then 'feed_post'
      else 'forum_post'
    end;
    event_name := resource_type || '.' || event_action;
    actor_uuid := coalesce((row_data ->> 'author_id')::uuid, (previous_data ->> 'author_id')::uuid);
  elsif tg_table_name = 'comments' then
    event_name := 'comment.' || event_action;
    resource_type := 'comment';
    actor_uuid := coalesce((row_data ->> 'author_id')::uuid, (previous_data ->> 'author_id')::uuid);
  else
    raise exception 'Unsupported content activity table.';
  end if;

  perform security.write_event(
    event_name,
    case when tg_op = 'INSERT' then 'accepted' else 'completed' end,
    'info',
    event_action,
    actor_uuid,
    resource_type,
    target_uuid,
    event_metadata,
    'postgres-trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function security.audit_content_activity() from public, anon, authenticated;

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
