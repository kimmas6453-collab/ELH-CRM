begin;
create table public.admin_events(id bigint generated always as identity primary key,actor uuid not null references public.profiles(id),kind text not null,target uuid references public.profiles(id),detail jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.admin_events enable row level security;
revoke all on public.admin_events from anon,authenticated;
grant select on public.admin_events to authenticated;
create policy admin_events_read on public.admin_events for select to authenticated using((select private.is_admin()));
create function public.crm_set_active(p_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được quản lý tài khoản';end if;
 if p_id=auth.uid() then raise exception 'Không thể tự khóa tài khoản';end if;
 if p_active is null then raise exception 'Trạng thái không hợp lệ';end if;
 update public.profiles set active=p_active where id=p_id and role<>'ADMIN';
 if not found then raise exception 'Không thể thay đổi tài khoản này';end if;
 insert into public.admin_events(actor,kind,target,detail) values(auth.uid(),'ACCOUNT_ACTIVE',p_id,jsonb_build_object('active',p_active));
end $$;
create function public.crm_team() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được quản lý đội ngũ';end if;
 select jsonb_build_object('members',(select coalesce(jsonb_agg(t),'[]') from(
 select p.id,p.name,p.email,p.role,p.active,count(l.id) as assigned,
 count(l.id) filter(where l.status in ('Mới','Chưa liên hệ')) as pending,
 count(l.id) filter(where l.next_followup<(now() at time zone 'Asia/Ho_Chi_Minh')::date) as overdue,
 count(l.id) filter(where l.status='Booking') as booking,max(l.last_contact) as last_contact
 from public.profiles p left join public.leads l on l.assigned_to=p.id group by p.id order by p.role,p.email) t),
 'pool',(select count(*) from public.leads where assigned_to is null),
 'invalid_phones',(select count(*) from public.leads where phone !~ '^0[0-9]{9}$'),
 'sync',(select to_jsonb(s) from public.callio_sync_state s where id='callio'),
 'unmapped_calls',(select count(*) from public.callio_calls where owner_id is null)) into result;
 return result;
end $$;
revoke all on function public.crm_set_active(uuid,boolean),public.crm_team() from public,anon;
grant execute on function public.crm_set_active(uuid,boolean),public.crm_team() to authenticated;
commit;
