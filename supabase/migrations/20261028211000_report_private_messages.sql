-- Allow reporting an individual private message without exposing its
-- conversation to staff or other users.

alter table public.reports
  drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('user', 'project', 'post', 'comment', 'message'));

alter table public.moderated_content
  drop constraint if exists moderated_content_target_type_check;
alter table public.moderated_content
  add constraint moderated_content_target_type_check
  check (target_type in ('project', 'post', 'comment', 'message'));

create or replace function public.message_is_visible(message_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select public.can_access_conversation(m.conversation_id)
      and not exists (
        select 1 from public.moderated_content mc
        where mc.target_type = 'message'
          and mc.target_id = m.id
      )
    from public.messages m
    where m.id = message_uuid
  ), false);
$$;
revoke all on function public.message_is_visible(uuid) from public;
grant execute on function public.message_is_visible(uuid) to authenticated;

drop policy if exists "member reads messages" on public.messages;
create policy "member reads messages" on public.messages for select
  using (public.message_is_visible(id));

create or replace function public.submit_report(
  target_kind text,
  target_uuid uuid,
  report_reason text,
  report_details text default ''
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_report_id uuid;
  clean_details text := coalesce(report_details, '');
begin
  if auth.uid() is null then raise exception 'Sign in to submit a report.'; end if;
  if public.account_is_suspended(auth.uid()) then raise exception 'This account cannot submit reports.'; end if;
  if target_kind not in ('user', 'project', 'post', 'comment', 'message') then
    raise exception 'This item cannot be reported.';
  end if;
  if report_reason not in ('spam', 'harassment', 'off_topic', 'misleading', 'inappropriate', 'other') then
    raise exception 'Choose a valid report reason.';
  end if;
  if char_length(clean_details) > 2000 then raise exception 'Report details are too long.'; end if;
  if target_kind = 'user' and target_uuid = auth.uid() then raise exception 'You cannot report your own account.'; end if;
  if target_kind = 'user' and not exists (select 1 from public.profiles p where p.id = target_uuid) then
    raise exception 'That account could not be found.';
  elsif target_kind = 'project' and not exists (select 1 from public.projects p where p.id = target_uuid) then
    raise exception 'That project could not be found.';
  elsif target_kind = 'post' and not exists (select 1 from public.posts p where p.id = target_uuid) then
    raise exception 'That post or forum thread could not be found.';
  elsif target_kind = 'comment' and not exists (select 1 from public.comments c where c.id = target_uuid) then
    raise exception 'That comment could not be found.';
  elsif target_kind = 'message' and not exists (
    select 1 from public.messages m
    where m.id = target_uuid
      and m.sender_id <> auth.uid()
      and public.can_access_conversation(m.conversation_id)
  ) then
    raise exception 'That message could not be found or cannot be reported.';
  end if;
  if (select count(*) from public.reports r
      where r.reporter_id = auth.uid() and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You have submitted several reports recently. Please try again later.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), target_kind, target_uuid, report_reason, clean_details)
  returning id into new_report_id;
  return new_report_id;
end;
$$;

create or replace function public.resolve_report(
  report_uuid uuid,
  moderation_action text,
  action_reason text default ''
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  report_row public.reports%rowtype;
  clean_reason text := left(trim(coalesce(action_reason, '')), 1000);
begin
  select * into report_row from public.reports where id = report_uuid for update;
  if not found then raise exception 'That report could not be found.'; end if;
  if report_row.status not in ('open', 'in_review') then raise exception 'That report has already been resolved.'; end if;
  if not public.can_moderate_target(report_row.target_type) then raise exception 'You do not have permission to review this report.'; end if;
  if report_row.status = 'in_review'
    and report_row.reviewer_id <> auth.uid()
    and not public.current_user_has_role('admin') then
    raise exception 'This report is assigned to another reviewer.';
  end if;
  if clean_reason = '' then raise exception 'Add a reason for this decision.'; end if;

  if moderation_action = 'dismiss' then
    update public.reports set status = 'dismissed', reviewer_id = auth.uid(),
      resolution = clean_reason, updated_at = now() where id = report_uuid;
  elsif moderation_action in ('hide', 'remove', 'restore') then
    if report_row.target_type not in ('project', 'post', 'comment', 'message') then
      raise exception 'Only admins can take account-level action.';
    end if;
    if moderation_action = 'restore' then
      delete from public.moderated_content
      where target_type = report_row.target_type and target_id = report_row.target_id;
    else
      insert into public.moderated_content (target_type, target_id, state, reason, updated_by)
      values (report_row.target_type, report_row.target_id,
        case when moderation_action = 'remove' then 'removed' else 'hidden' end,
        clean_reason, auth.uid())
      on conflict (target_type, target_id) do update set
        state = excluded.state, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now();
    end if;
    update public.reports set status = 'actioned', reviewer_id = auth.uid(),
      resolution = clean_reason, updated_at = now() where id = report_uuid;
  elsif moderation_action in ('suspend', 'reinstate') then
    if report_row.target_type <> 'user' or not public.current_user_has_role('admin') then
      raise exception 'Only admins can take account-level action.';
    end if;
    if report_row.target_id = auth.uid() then raise exception 'You cannot suspend your own account.'; end if;
    if moderation_action = 'suspend' and exists (
      select 1 from public.staff_roles where user_id = report_row.target_id and role = 'admin'
    ) then
      raise exception 'Remove admin access before suspending this account.';
    end if;
    insert into public.account_restrictions (user_id, suspended, reason, updated_by)
    values (report_row.target_id, moderation_action = 'suspend', clean_reason, auth.uid())
    on conflict (user_id) do update set suspended = excluded.suspended,
      reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now();
    if moderation_action = 'suspend' then
      delete from public.staff_roles where user_id = report_row.target_id;
    end if;
    update public.reports set status = 'actioned', reviewer_id = auth.uid(),
      resolution = clean_reason, updated_at = now() where id = report_uuid;
  else
    raise exception 'Choose a valid moderation action.';
  end if;

  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), moderation_action, report_row.target_type, report_row.target_id, clean_reason);
end;
$$;

create or replace function public.get_reported_message(report_uuid uuid)
returns jsonb
language plpgsql security definer set search_path = public
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
  if message_uuid is null then raise exception 'That message report could not be found.'; end if;

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
