begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('ADMIN','TELESALES','EXECUTIVE'));
create or replace function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and role in ('ADMIN','TELESALES'));
$$;
alter table public.leads add column legacy_data jsonb not null default '{}';
alter table public.leads add column last_contact timestamptz;
alter table public.activities add column legacy_id text unique;
alter table public.activities add column next_followup date;
-- Retain source records and exceptional phone formats without allowing accidental dialing.
alter table public.leads drop constraint leads_phone_check;
alter table public.leads add constraint leads_phone_check check(length(phone)<=100);
create table public.legacy_archive (
 source text not null, record_key text not null, payload jsonb not null,
 primary key(source,record_key)
);
alter table public.legacy_archive enable row level security;
revoke all on public.legacy_archive from anon,authenticated;
grant select on public.legacy_archive to authenticated;
create policy legacy_admin_read on public.legacy_archive for select to authenticated using((select private.is_admin()));
create or replace function public.crm_prepare_call(p_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('phone',phone,'name',name) into result from public.leads where id=p_id and assigned_to is not null;
 if result is null then raise exception 'Không có quyền gọi khách này'; end if;
 if (result->>'phone') !~ '^0[0-9]{9}$' then raise exception 'Số điện thoại nguồn cần kiểm tra trước khi gọi'; end if;
 return result;
end $$;
create or replace function public.crm_create(p_name text,p_phone text,p_project text,p_source text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare lid text;
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập'; end if;
 if p_phone is null or p_phone !~ '^0[0-9]{9}$' then raise exception 'Số điện thoại không hợp lệ'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone,0));
 if exists(select 1 from public.leads where phone=p_phone) then raise exception 'Số điện thoại đã có trong hệ thống. Liên hệ quản trị viên.'; end if;
 insert into public.leads(name,phone,project,source,assigned_to) values(btrim(p_name),p_phone,left(p_project,200),left(p_source,200),auth.uid()) returning id into lid;
 insert into public.activities(lead_id,actor,kind) values(lid,auth.uid(),'CREATE');
 return jsonb_build_object('id',lid);
end $$;
create or replace function public.crm_executive_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','EXECUTIVE')) then raise exception 'Không có quyền xem báo cáo'; end if;
 select jsonb_build_object('assigned',count(*) filter(where assigned_to is not null),'pool',count(*) filter(where assigned_to is null),
 'pending',count(*) filter(where assigned_to is not null and status in ('Mới','Chưa liên hệ')),
 'booking',count(*) filter(where assigned_to is not null and status='Booking'),
 'team',(select coalesce(jsonb_agg(t),'[]') from (
 select p.name,p.active,count(l.id) as total,count(l.id) filter(where l.status not in ('Mới','Chưa liên hệ')) as contacted,
 count(l.id) filter(where l.status='Booking') as booking from public.profiles p left join public.leads l on l.assigned_to=p.id
 where p.role='TELESALES' group by p.id order by p.name) t)) into result from public.leads;
 return result;
end $$;
revoke all on function public.crm_executive_summary() from public,anon;
grant execute on function public.crm_executive_summary() to authenticated;
commit;
