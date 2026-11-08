create or replace function security.enrich_security_event_content()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  excerpt_text text;
  excerpt_title text;
begin
  if new.event_type = 'report.created' and new.target_type = 'report' then
    select left(
      nullif(regexp_replace(coalesce(r.details, ''), '[[:cntrl:]]+', ' ', 'g'), ''),
      200
    )
    into excerpt_text
    from public.reports r
    where r.id = new.target_id;

    new.metadata := new.metadata || jsonb_strip_nulls(jsonb_build_object(
      'content_excerpt', excerpt_text
    ));
  elsif new.event_type in (
    'feed_post.created', 'feed_post.updated', 'feed_post.deleted',
    'forum_post.created', 'forum_post.updated', 'forum_post.deleted'
  ) and new.target_type in ('feed_post', 'forum_post') then
    select
      left(nullif(regexp_replace(coalesce(p.title, ''), '[[:cntrl:]]+', ' ', 'g'), ''), 100),
      left(nullif(regexp_replace(coalesce(p.body, ''), '[[:cntrl:]]+', ' ', 'g'), ''), 200)
    into excerpt_title, excerpt_text
    from public.posts p
    where p.id = new.target_id;

    new.metadata := new.metadata || jsonb_strip_nulls(jsonb_build_object(
      'content_title', excerpt_title,
      'content_excerpt', excerpt_text
    ));
  elsif new.event_type in (
    'comment.created', 'comment.updated', 'comment.deleted'
  ) and new.target_type = 'comment' then
    select left(
      nullif(regexp_replace(coalesce(c.body, ''), '[[:cntrl:]]+', ' ', 'g'), ''),
      200
    )
    into excerpt_text
    from public.comments c
    where c.id = new.target_id;

    new.metadata := new.metadata || jsonb_strip_nulls(jsonb_build_object(
      'content_excerpt', excerpt_text
    ));
  end if;

  return new;
end;
$$;
revoke all on function security.enrich_security_event_content() from public, anon, authenticated;

drop trigger if exists enrich_security_event_content on public.security_audit_events;
create trigger enrich_security_event_content
  before insert on public.security_audit_events
  for each row execute function security.enrich_security_event_content();

drop trigger if exists audit_project_activity on public.projects;
create trigger audit_project_activity
  after insert or update on public.projects
  for each row execute function security.audit_content_activity();
create trigger audit_project_delete_activity
  before delete on public.projects
  for each row execute function security.audit_content_activity();

drop trigger if exists audit_post_activity on public.posts;
create trigger audit_post_activity
  after insert or update on public.posts
  for each row execute function security.audit_content_activity();
create trigger audit_post_delete_activity
  before delete on public.posts
  for each row execute function security.audit_content_activity();

drop trigger if exists audit_comment_activity on public.comments;
create trigger audit_comment_activity
  after insert or update on public.comments
  for each row execute function security.audit_content_activity();
create trigger audit_comment_delete_activity
  before delete on public.comments
  for each row execute function security.audit_content_activity();

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
  project_title text,
  content_title text,
  content_excerpt text
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
    e.metadata ->> 'project_title',
    e.metadata ->> 'content_title',
    e.metadata ->> 'content_excerpt'
  from claimed
  join public.security_audit_events e on e.event_id = claimed.event_id;
end;
$$;
revoke all on function public.claim_security_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_security_alerts(integer) to service_role;

notify pgrst, 'reload schema';
