alter table public.security_audit_events
  drop constraint if exists security_audit_events_source_check;

alter table public.security_audit_events
  add constraint security_audit_events_source_check
  check (source in ('postgres-trigger', 'supabase-edge-function', 'client-application'));

create or replace function public.log_client_error(operation_key text, error_category text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, security
set row_security = off
as $$
declare
  recent_error_count bigint;
begin
  if auth.uid() is null then
    raise exception 'An authenticated user is required.';
  end if;
  if operation_key is null or operation_key !~ '^[a-z][a-z0-9_]{0,31}$' then
    raise exception 'Invalid client error operation.';
  end if;
  if error_category is null or error_category not in (
    'network_error',
    'permission_denied',
    'rate_limited',
    'auth_error',
    'constraint_error',
    'validation_error',
    'request_failed'
  ) then
    raise exception 'Invalid client error category.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':client-error-log', 0));
  select count(*) into recent_error_count
  from public.security_audit_events
  where event_type = 'application.error'
    and actor_user_id = auth.uid()
    and occurred_at > now() - interval '1 minute';
  if recent_error_count >= 30 then
    raise exception using
      errcode = 'P0001',
      message = 'Client error logging rate limit reached.';
  end if;

  return security.write_event(
    'application.error',
    'failed',
    'medium',
    error_category,
    auth.uid(),
    operation_key,
    null,
    '{}'::jsonb,
    'client-application'
  );
end;
$$;
revoke all on function public.log_client_error(text, text) from public, anon;
grant execute on function public.log_client_error(text, text) to authenticated;

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
    '{}'::jsonb,
    'postgres-trigger'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function security.audit_content_activity() from public, anon, authenticated;

drop trigger if exists audit_project_activity on public.projects;
create trigger audit_project_activity
  after insert or update or delete on public.projects
  for each row execute function security.audit_content_activity();

drop trigger if exists audit_post_activity on public.posts;
create trigger audit_post_activity
  after insert or update or delete on public.posts
  for each row execute function security.audit_content_activity();

drop trigger if exists audit_comment_activity on public.comments;
create trigger audit_comment_activity
  after insert or update or delete on public.comments
  for each row execute function security.audit_content_activity();

create or replace function security.purge_expired_security_events()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  deleted_count bigint;
begin
  delete from public.security_audit_events
  where occurred_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function security.purge_expired_security_events() from public, anon, authenticated;
grant execute on function security.purge_expired_security_events() to service_role;

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
