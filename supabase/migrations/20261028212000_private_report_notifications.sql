-- Keep report records private to staff while notifying reporters without
-- exposing the reviewer, report target, or moderation decision.

drop policy if exists "users and moderators read reports" on public.reports;
create policy "moderators read reports" on public.reports for select
  using (public.can_moderate_target(target_type));

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'message', 'report_reviewed', 'report_actioned'));

create or replace function public.notify_reporter_of_review()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status in ('open', 'in_review')
    and new.status in ('actioned', 'dismissed') then
    insert into public.notifications (user_id, actor_id, type, ref_id)
    values (
      new.reporter_id,
      null,
      case when new.status = 'actioned' then 'report_actioned' else 'report_reviewed' end,
      null
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_reporter_of_review() from public;

drop trigger if exists on_report_reviewed on public.reports;
create trigger on_report_reviewed
  after update of status on public.reports
  for each row execute function public.notify_reporter_of_review();
