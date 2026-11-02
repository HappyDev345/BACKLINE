drop policy if exists "authenticated uploads media" on storage.objects;
drop policy if exists "owners update media" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatar-quarantine',
  'avatar-quarantine',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists security.avatar_upload_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  upload_count smallint not null check (upload_count between 1 and 10)
);
revoke all on security.avatar_upload_usage from public, anon, authenticated, service_role;

create or replace function public.list_expired_avatar_quarantine_objects(batch_size integer default 100)
returns table (object_name text)
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the cleanup service.';
  end if;

  return query
  select o.name
  from storage.objects o
  where o.bucket_id = 'avatar-quarantine'
    and o.created_at < now() - interval '1 hour'
  order by o.created_at, o.name
  limit least(greatest(coalesce(batch_size, 100), 1), 100);
end;
$$;
revoke all on function public.list_expired_avatar_quarantine_objects(integer)
  from public, anon, authenticated;
grant execute on function public.list_expired_avatar_quarantine_objects(integer)
  to service_role;

create or replace function public.claim_avatar_upload_slot(account_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
declare
  slot_claimed boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the upload service.';
  end if;

  insert into security.avatar_upload_usage as current_usage (user_id, window_started_at, upload_count)
  values (account_uuid, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when current_usage.window_started_at <= now() - interval '1 hour' then now()
      else current_usage.window_started_at
    end,
    upload_count = case
      when current_usage.window_started_at <= now() - interval '1 hour' then 1
      else current_usage.upload_count + 1
    end
  where current_usage.window_started_at <= now() - interval '1 hour'
     or current_usage.upload_count < 10
  returning true into slot_claimed;

  return coalesce(slot_claimed, false);
end;
$$;
revoke all on function public.claim_avatar_upload_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_avatar_upload_slot(uuid) to service_role;

create or replace function public.log_upload_security_event(
  event_name text,
  event_result text,
  severity_level text,
  reason text,
  account_uuid uuid,
  upload_uuid uuid,
  media_type text,
  byte_size integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, security
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'This operation is only available to the upload service.';
  end if;
  if event_name not in (
    'upload.received', 'upload.rejected', 'upload.accepted', 'upload.failed', 'upload.deleted'
  ) then
    raise exception 'Unsupported upload event.';
  end if;

  return security.write_event(
    event_name,
    event_result,
    severity_level,
    reason,
    account_uuid,
    'upload',
    upload_uuid,
    jsonb_build_object('media_type', media_type, 'byte_size', byte_size),
    'supabase-edge-function'
  );
end;
$$;
revoke all on function public.log_upload_security_event(text, text, text, text, uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.log_upload_security_event(text, text, text, text, uuid, uuid, text, integer)
  to service_role;
