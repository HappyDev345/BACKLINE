-- Suspended profiles stay hidden from normal profile reads, including staff.
-- Admins retain a dedicated account-management lookup for reinstatement.

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select profile_uuid = auth.uid()
    or not exists (
      select 1
      from public.account_restrictions ar
      where ar.user_id = profile_uuid and ar.suspended
    );
$$;

create or replace function public.admin_list_accounts(search_term text default '')
returns setof jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  term text := trim(coalesce(search_term, ''));
begin
  if not public.current_user_has_role('admin') then
    raise exception 'Only admins can manage accounts.';
  end if;

  return query
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'created_at', p.created_at,
    'staff_roles', coalesce((
      select jsonb_agg(jsonb_build_object('role', sr.role))
      from public.staff_roles sr where sr.user_id = p.id
    ), '[]'::jsonb),
    'profile_badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge', pb.badge))
      from public.profile_badges pb where pb.user_id = p.id
    ), '[]'::jsonb),
    'account_restrictions', coalesce((
      select jsonb_agg(jsonb_build_object('suspended', ar.suspended, 'reason', ar.reason))
      from public.account_restrictions ar where ar.user_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  where term = ''
    or p.display_name ilike '%' || term || '%'
    or p.username ilike '%' || term || '%'
    or p.id::text = term
  order by p.created_at desc
  limit 100;
end;
$$;

revoke all on function public.admin_list_accounts(text) from public;
grant execute on function public.admin_list_accounts(text) to authenticated;

drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "visible profiles readable" on public.profiles;
create policy "visible profiles readable" on public.profiles for select
  using (public.profile_is_visible(id));
