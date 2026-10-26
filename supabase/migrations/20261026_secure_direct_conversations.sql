begin;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to anon, authenticated;

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'A conversation requires another user';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'User not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, target_user_id::text)
        || ':' ||
      greatest(current_user_id::text, target_user_id::text),
      0
    )
  );

  select mine.conversation_id
  into conversation_id
  from public.conversation_members mine
  join public.conversation_members theirs
    on theirs.conversation_id = mine.conversation_id
  where mine.user_id = current_user_id
    and theirs.user_id = target_user_id
    and (
      select pg_catalog.count(*)
      from public.conversation_members members
      where members.conversation_id = mine.conversation_id
    ) = 2
  limit 1;

  if conversation_id is null then
    insert into public.conversations default values
    returning id into conversation_id;

    insert into public.conversation_members (conversation_id, user_id)
    values (conversation_id, current_user_id), (conversation_id, target_user_id);
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

drop policy if exists "member reads conversation" on public.conversations;
drop policy if exists "authenticated starts conversation" on public.conversations;
create policy "member reads conversation" on public.conversations for select
  using (public.is_conversation_member(id));

drop policy if exists "member reads membership" on public.conversation_members;
drop policy if exists "user joins membership" on public.conversation_members;
create policy "member reads membership" on public.conversation_members for select
  using (public.is_conversation_member(conversation_id));

drop policy if exists "member reads messages" on public.messages;
create policy "member reads messages" on public.messages for select
  using (public.is_conversation_member(conversation_id));

drop policy if exists "member sends message" on public.messages;
create policy "member sends message" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "authenticated uploads media" on storage.objects;
create policy "authenticated uploads media" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'media';

commit;
