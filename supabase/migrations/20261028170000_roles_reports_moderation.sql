-- Roles, verified badges, user reports, content moderation, and the staff workspace.

create table if not exists public.staff_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'feed_moderator', 'project_moderator')),
  primary key (user_id, role)
);

create table if not exists public.profile_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null check (badge = 'verified'),
  created_at timestamptz not null default now(),
  primary key (user_id, badge)
);

create table if not exists public.account_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  suspended boolean not null default false,
  reason text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'project', 'post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'off_topic', 'misleading', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reports_one_open_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where status in ('open', 'in_review');
create index if not exists reports_queue_order on public.reports (status, created_at desc);

create table if not exists public.moderated_content (
  target_type text not null check (target_type in ('project', 'post', 'comment')),
  target_id uuid not null,
  state text not null check (state in ('hidden', 'removed')),
  reason text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (target_type, target_id)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists moderation_actions_recent on public.moderation_actions (created_at desc);

create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists staff_notes_report_order on public.staff_notes (report_id, created_at);

alter table public.conversations
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.staff_roles enable row level security;
alter table public.profile_badges enable row level security;
alter table public.account_restrictions enable row level security;
alter table public.reports enable row level security;
alter table public.moderated_content enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.staff_notes enable row level security;

create or replace function public.current_user_has_role(role_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_roles sr
    where sr.user_id = auth.uid() and sr.role = role_name
      and not exists (
        select 1 from public.account_restrictions ar
        where ar.user_id = sr.user_id and ar.suspended
      )
  );
$$;

create or replace function public.can_moderate_target(target_kind text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_user_has_role('admin')
    or (target_kind in ('post', 'comment') and public.current_user_has_role('feed_moderator'))
    or (target_kind = 'project' and public.current_user_has_role('project_moderator'));
$$;

create or replace function public.account_is_suspended(account_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and account_id = auth.uid() and exists (
    select 1 from public.account_restrictions ar
    where ar.user_id = account_id and ar.suspended
  );
$$;

create or replace function public.content_is_visible(target_kind text, target_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_moderate_target(target_kind)
    or not exists (
      select 1 from public.moderated_content mc
      where mc.target_type = target_kind and mc.target_id = target_uuid
    );
$$;

create or replace function public.can_access_conversation(conversation_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = conversation_uuid
      and c.created_by is not null
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.current_user_has_role(text) from public;
revoke all on function public.can_moderate_target(text) from public;
revoke all on function public.account_is_suspended(uuid) from public;
revoke all on function public.content_is_visible(text, uuid) from public;
revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.current_user_has_role(text) to anon, authenticated;
grant execute on function public.can_moderate_target(text) to anon, authenticated;
grant execute on function public.account_is_suspended(uuid) to anon, authenticated;
grant execute on function public.content_is_visible(text, uuid) to anon, authenticated;
grant execute on function public.can_access_conversation(uuid) to anon, authenticated;

create policy "staff badges public readable" on public.staff_roles for select using (true);
create policy "profile badges public readable" on public.profile_badges for select using (true);
create policy "admins read account restrictions" on public.account_restrictions for select
  using (public.current_user_has_role('admin'));
create policy "users and moderators read reports" on public.reports for select
  using (auth.uid() = reporter_id or public.can_moderate_target(target_type));
grant select on public.staff_roles, public.profile_badges to anon, authenticated;
grant select on public.reports to authenticated;
grant select on public.account_restrictions, public.moderated_content, public.moderation_actions, public.staff_notes to authenticated;
grant insert on public.staff_notes to authenticated;
revoke insert, update, delete on public.reports from anon, authenticated;
create policy "moderators read moderated content" on public.moderated_content for select
  using (public.can_moderate_target(target_type));
create policy "staff read moderation history" on public.moderation_actions for select
  using (public.can_moderate_target(target_type));
create policy "staff read case notes" on public.staff_notes for select
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_id and public.can_moderate_target(r.target_type)
    )
  );
create policy "staff add case notes" on public.staff_notes for insert
  with check (
    auth.uid() = author_id
    and not public.account_is_suspended(auth.uid())
    and exists (
      select 1 from public.reports r
      where r.id = report_id and public.can_moderate_target(r.target_type)
    )
  );

drop policy if exists "projects readable" on public.projects;
drop policy if exists "creator inserts project" on public.projects;
drop policy if exists "creator updates project" on public.projects;
drop policy if exists "creator deletes project" on public.projects;
create policy "projects readable" on public.projects for select
  using (public.content_is_visible('project', id));
create policy "creator inserts project" on public.projects for insert
  with check (auth.uid() = creator_id and not public.account_is_suspended(auth.uid()));
create policy "creator updates project" on public.projects for update
  using (auth.uid() = creator_id and not public.account_is_suspended(auth.uid()))
  with check (auth.uid() = creator_id and not public.account_is_suspended(auth.uid()));
create policy "creator deletes project" on public.projects for delete
  using (auth.uid() = creator_id and not public.account_is_suspended(auth.uid()));

drop policy if exists "posts readable" on public.posts;
drop policy if exists "author inserts post" on public.posts;
drop policy if exists "author updates post" on public.posts;
drop policy if exists "author deletes post" on public.posts;
create policy "posts readable" on public.posts for select
  using (public.content_is_visible('post', id));
create policy "author inserts post" on public.posts for insert
  with check (auth.uid() = author_id and not public.account_is_suspended(auth.uid()));
create policy "author updates post" on public.posts for update
  using (auth.uid() = author_id and not public.account_is_suspended(auth.uid()))
  with check (auth.uid() = author_id and not public.account_is_suspended(auth.uid()));
create policy "author deletes post" on public.posts for delete
  using (auth.uid() = author_id and not public.account_is_suspended(auth.uid()));

drop policy if exists "comments readable" on public.comments;
drop policy if exists "user inserts comment" on public.comments;
drop policy if exists "author deletes comment" on public.comments;
create policy "comments readable" on public.comments for select
  using (
    public.content_is_visible('comment', id)
    and public.content_is_visible('post', post_id)
  );
create policy "user inserts comment" on public.comments for insert
  with check (
    auth.uid() = author_id and not public.account_is_suspended(auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "author deletes comment" on public.comments for delete
  using (auth.uid() = author_id and not public.account_is_suspended(auth.uid()));

drop policy if exists "user inserts like" on public.likes;
create policy "user inserts like" on public.likes for insert
  with check (auth.uid() = user_id and not public.account_is_suspended(auth.uid()));
drop policy if exists "user follows" on public.follows;
create policy "user follows" on public.follows for insert
  with check (auth.uid() = follower_id and not public.account_is_suspended(auth.uid()));
drop policy if exists "own saves insert" on public.saved_projects;
create policy "own saves insert" on public.saved_projects for insert
  with check (auth.uid() = user_id and not public.account_is_suspended(auth.uid()));

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update
  using (auth.uid() = id and not public.account_is_suspended(auth.uid()))
  with check (auth.uid() = id and not public.account_is_suspended(auth.uid()));

drop policy if exists "authenticated starts conversation" on public.conversations;
create policy "authenticated starts conversation" on public.conversations for insert
  with check (auth.uid() = created_by and not public.account_is_suspended(auth.uid()));
drop policy if exists "member reads conversation" on public.conversations;
create policy "member reads conversation" on public.conversations for select
  using (created_by is not null and public.can_access_conversation(id));
drop policy if exists "member reads membership" on public.conversation_members;
create policy "member reads membership" on public.conversation_members for select
  using (public.can_access_conversation(conversation_id));
drop policy if exists "user joins membership" on public.conversation_members;
create policy "creator adds own membership" on public.conversation_members for insert
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );
drop policy if exists "member reads messages" on public.messages;
create policy "member reads messages" on public.messages for select
  using (public.can_access_conversation(conversation_id));
drop policy if exists "member sends message" on public.messages;
create policy "member sends message" on public.messages for insert
  with check (
    auth.uid() = sender_id and not public.account_is_suspended(auth.uid())
    and public.can_access_conversation(conversation_id)
  );

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
  if target_kind not in ('user', 'project', 'post', 'comment') then
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
    if report_row.target_type not in ('project', 'post', 'comment') then
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

create or replace function public.claim_report(report_uuid uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  report_row public.reports%rowtype;
begin
  select * into report_row from public.reports where id = report_uuid for update;
  if not found then raise exception 'That report could not be found.'; end if;
  if not public.can_moderate_target(report_row.target_type) then raise exception 'You do not have permission to review this report.'; end if;
  if report_row.status <> 'open' then raise exception 'That report is no longer open.'; end if;
  update public.reports set status = 'in_review', reviewer_id = auth.uid(), updated_at = now()
  where id = report_uuid;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), 'claim_report', report_row.target_type, report_row.target_id, '');
end;
$$;

create or replace function public.admin_set_staff_role(
  account_uuid uuid,
  role_name text,
  grant_role boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.current_user_has_role('admin') then raise exception 'Only admins can manage staff roles.'; end if;
  if role_name not in ('admin', 'feed_moderator', 'project_moderator') then raise exception 'Choose a valid staff role.'; end if;
  if grant_role and exists (
    select 1 from public.account_restrictions
    where user_id = account_uuid and suspended
  ) then raise exception 'Reinstate the account before granting a staff role.'; end if;
  if account_uuid = auth.uid() and role_name = 'admin' and not grant_role
    and (select count(*) from public.staff_roles where role = 'admin') <= 1 then
    raise exception 'The last admin cannot remove their own role.';
  end if;
  if not exists (select 1 from public.profiles where id = account_uuid) then raise exception 'That account could not be found.'; end if;
  if grant_role then
    insert into public.staff_roles (user_id, role)
    values (account_uuid, role_name) on conflict (user_id, role) do nothing;
  else
    delete from public.staff_roles where user_id = account_uuid and role = role_name;
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when grant_role then 'grant_role:' else 'revoke_role:' end || role_name,
    'user', account_uuid, '');
end;
$$;

create or replace function public.admin_set_verified(
  account_uuid uuid,
  is_verified boolean,
  verification_reason text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  clean_reason text := left(trim(coalesce(verification_reason, '')), 1000);
begin
  if not public.current_user_has_role('admin') then raise exception 'Only admins can manage verification.'; end if;
  if not exists (select 1 from public.profiles where id = account_uuid) then raise exception 'That account could not be found.'; end if;
  if is_verified and clean_reason = '' then raise exception 'Add a reason for granting verification.'; end if;
  if is_verified then
    insert into public.profile_badges (user_id, badge)
    values (account_uuid, 'verified')
    on conflict (user_id, badge) do nothing;
  else
    delete from public.profile_badges where user_id = account_uuid and badge = 'verified';
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when is_verified then 'grant_verified' else 'revoke_verified' end,
    'user', account_uuid, clean_reason);
end;
$$;

create or replace function public.admin_set_account_suspended(
  account_uuid uuid,
  is_suspended boolean,
  restriction_reason text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  clean_reason text := left(trim(coalesce(restriction_reason, '')), 1000);
begin
  if not public.current_user_has_role('admin') then raise exception 'Only admins can manage account standing.'; end if;
  if account_uuid = auth.uid() and is_suspended then raise exception 'You cannot suspend your own account.'; end if;
  if not exists (select 1 from public.profiles where id = account_uuid) then raise exception 'That account could not be found.'; end if;
  if is_suspended and clean_reason = '' then raise exception 'Add a reason for suspending this account.'; end if;
  if is_suspended and exists (
    select 1 from public.staff_roles where user_id = account_uuid and role = 'admin'
  ) then raise exception 'Remove admin access before suspending this account.';
  end if;
  insert into public.account_restrictions (user_id, suspended, reason, updated_by)
  values (account_uuid, is_suspended, clean_reason, auth.uid())
  on conflict (user_id) do update set suspended = excluded.suspended,
    reason = excluded.reason, updated_by = auth.uid(), updated_at = now();
  if is_suspended then
    delete from public.staff_roles where user_id = account_uuid;
  end if;
  insert into public.moderation_actions (actor_id, action, target_type, target_id, reason)
  values (auth.uid(), case when is_suspended then 'suspend_account' else 'reinstate_account' end,
    'user', account_uuid, clean_reason);
end;
$$;

create or replace function public.create_conversation(other_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  conversation_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to start a conversation.'; end if;
  if other_user = auth.uid() then raise exception 'You cannot start a conversation with yourself.'; end if;
  if public.account_is_suspended(auth.uid()) then raise exception 'This account cannot start conversations.'; end if;
  if not exists (select 1 from public.profiles where id = other_user) then raise exception 'That account could not be found.'; end if;
  if exists (
    select 1 from public.account_restrictions
    where user_id = other_user and suspended
  ) then raise exception 'This account cannot receive new conversations.'; end if;
  insert into public.conversations (created_by) values (auth.uid()) returning id into conversation_uuid;
  insert into public.conversation_members (conversation_id, user_id)
  values (conversation_uuid, auth.uid()), (conversation_uuid, other_user);
  return conversation_uuid;
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public;
revoke all on function public.resolve_report(uuid, text, text) from public;
revoke all on function public.claim_report(uuid) from public;
revoke all on function public.admin_set_staff_role(uuid, text, boolean) from public;
revoke all on function public.admin_set_verified(uuid, boolean, text) from public;
revoke all on function public.admin_set_account_suspended(uuid, boolean, text) from public;
revoke all on function public.create_conversation(uuid) from public;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;
grant execute on function public.claim_report(uuid) to authenticated;
grant execute on function public.admin_set_staff_role(uuid, text, boolean) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_account_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.create_conversation(uuid) to authenticated;
