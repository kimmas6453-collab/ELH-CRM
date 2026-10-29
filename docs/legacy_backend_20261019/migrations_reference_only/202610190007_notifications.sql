begin;
create table public.notifications(id text primary key default gen_random_uuid()::text,owner_id uuid not null references public.profiles(id),kind text not null,title text not null,body text not null default '',created_at timestamptz not null default now(),read_at timestamptz);
create index notifications_owner_time on public.notifications(owner_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
create policy notification_read on public.notifications for select to authenticated using((select private.is_staff()) and owner_id=(select auth.uid()));
create function public.crm_read_notifications() returns void language sql security invoker set search_path='' as $$
 update public.notifications set read_at=now() where owner_id=auth.uid() and read_at is null;
$$;
grant update(read_at) on public.notifications to authenticated;
create policy notification_update on public.notifications for update to authenticated using((select private.is_staff()) and owner_id=(select auth.uid())) with check((select private.is_staff()) and owner_id=(select auth.uid()));
revoke all on function public.crm_read_notifications() from public,anon;
grant execute on function public.crm_read_notifications() to authenticated;
create function private.notify_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to then
  insert into public.notifications(owner_id,kind,title,body) values(new.assigned_to,'ALLOCATION','Bạn có khách hàng mới',new.name||' đã được phân bổ vào danh sách của bạn.');
 end if;
 return new;
end $$;
revoke all on function private.notify_assignment() from public,anon,authenticated;
create trigger notify_assignment after update of assigned_to on public.leads for each row execute function private.notify_assignment();
commit;
