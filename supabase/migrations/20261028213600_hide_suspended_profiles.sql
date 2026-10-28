-- Hide suspended profiles from public reads while allowing the account owner
-- and admins to access them.

create or replace function public.profile_is_visible(profile_uuid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select profile_uuid = auth.uid()
    or public.current_user_has_role('admin')
    or not exists (
      select 1
      from public.account_restrictions ar
      where ar.user_id = profile_uuid and ar.suspended
    );
$$;
revoke all on function public.profile_is_visible(uuid) from public;
grant execute on function public.profile_is_visible(uuid) to anon, authenticated;

drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "visible profiles readable" on public.profiles;
create policy "visible profiles readable" on public.profiles for select
  using (public.profile_is_visible(id));
