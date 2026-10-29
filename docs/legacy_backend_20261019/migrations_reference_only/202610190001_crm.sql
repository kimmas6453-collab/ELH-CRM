-- New Supabase project only. No legacy Sheet or auth.users data is modified.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id), email text not null unique,
 name text not null, role text not null check (role in ('ADMIN','TELESALES')),
 active boolean not null default true
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and role='ADMIN');
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active);
$$;
revoke all on function private.is_admin(), private.is_staff() from public;
grant execute on function private.is_admin(), private.is_staff() to authenticated;
create policy profiles_read on public.profiles for select to authenticated using
 ((id=(select auth.uid()) and active) or (select private.is_admin()));
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.profiles from anon,authenticated;

create table public.leads (
 id text primary key default gen_random_uuid()::text,
 customer_id text not null default gen_random_uuid()::text,
 name text not null check(length(name) between 1 and 200),
 phone text not null check(phone ~ '^0[0-9]{9}$'), project text not null default '',
 assigned_to uuid references public.profiles(id),
 status text not null default 'Mới' check(status in ('Mới','Chưa liên hệ','Không nghe máy','Đã liên hệ','Có nhu cầu','Hẹn gặp','Đang tư vấn','Không phù hợp','Booking')),
 next_followup date, notes text not null default '' check(length(notes)<=10000),
 source text not null default '', priority text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version bigint not null default 1,
 search_document tsvector generated always as (to_tsvector('simple',coalesce(name,'') || ' ' || phone || ' ' || project)) stored
);
create index leads_owner_page on public.leads(assigned_to,created_at desc,id desc);
create index leads_owner_status_page on public.leads(assigned_to,status,created_at desc,id desc);
create index leads_owner_due on public.leads(assigned_to,next_followup) where next_followup is not null;
create index leads_page on public.leads(created_at desc,id desc);
create index leads_phone on public.leads(phone);
create index leads_search on public.leads using gin(search_document);
alter table public.leads enable row level security;
revoke all on public.leads from anon,authenticated;
create policy leads_read on public.leads for select to authenticated using
 ((select private.is_staff()) and (assigned_to=(select auth.uid()) or (select private.is_admin())));
grant select on public.leads to authenticated;
-- All mutations go through narrowly authorized functions, not unrestricted table updates.
revoke insert,update,delete on public.leads from anon,authenticated;

create table public.activities (
 id bigint generated always as identity primary key,
 lead_id text not null references public.leads(id), actor uuid not null references public.profiles(id),
 kind text not null, status text, note text not null default '', created_at timestamptz not null default now()
);
create index activities_lead_page on public.activities(lead_id,created_at desc,id desc);
alter table public.activities enable row level security;
revoke all on public.activities from anon,authenticated;
create policy activity_read on public.activities for select to authenticated using
 (exists(select 1 from public.leads where id=lead_id));
grant select on public.activities to authenticated;
revoke insert,update,delete on public.activities from anon,authenticated;

create function public.crm_profile() returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p) from public.profiles p where id=(select auth.uid()) and active;
$$;

-- Keyset pagination, bounded response, no full-table transfer to the client.
create function public.crm_leads(p_query text default '', p_status text default '', p_mode text default 'all',
 p_cursor_at timestamptz default null,p_cursor_id text default null,p_limit integer default 30)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; lim integer:=least(50,greatest(1,coalesce(p_limit,30)));
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập'; end if;
 if p_mode not in ('all','today','overdue','pending','hot','booking','pool') then raise exception 'Bộ lọc không hợp lệ'; end if;
 if (p_cursor_at is null) <> (p_cursor_id is null) then raise exception 'Cursor không hợp lệ'; end if;
 if length(p_query)>150 then raise exception 'Từ khóa quá dài'; end if;
 with page as (
 select id,customer_id,name,phone,project,assigned_to,status,next_followup,source,created_at,version
 from public.leads
 where (p_status='' or status=p_status)
 and (btrim(p_query)='' or search_document @@ websearch_to_tsquery('simple',p_query))
 and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id))
 and case p_mode
 when 'pool' then assigned_to is null
 when 'today' then next_followup=today
 when 'overdue' then next_followup<today and status not in ('Booking','Không phù hợp')
 when 'pending' then status in ('Mới','Chưa liên hệ')
 when 'hot' then status in ('Có nhu cầu','Hẹn gặp','Đang tư vấn')
 when 'booking' then status='Booking' else assigned_to is not null end
 order by created_at desc,id desc limit lim+1
 ) select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]') into result from page;
 return jsonb_build_object('items',case when jsonb_array_length(result)>lim then result-lim else result end,'hasMore',jsonb_array_length(result)>lim);
end $$;

create function public.crm_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'pending',count(*) filter(where status in ('Mới','Chưa liên hệ')),
 'today',count(*) filter(where next_followup=(now() at time zone 'Asia/Ho_Chi_Minh')::date),
 'booking',count(*) filter(where status='Booking')) from public.leads where assigned_to is not null;
$$;
create function public.crm_detail(p_id text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('lead',to_jsonb(l)-'search_document','history',
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc),'[]') from
 (select id,kind,status,note,created_at from public.activities where lead_id=p_id order by created_at desc,id desc limit 50) a))
 from public.leads l where id=p_id;
$$;

create function public.crm_update(p_id text,p_version bigint,p_status text,p_next date,p_note text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.leads;
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập'; end if;
 select * into r from public.leads where id=p_id for update;
 if not found or (r.assigned_to is distinct from auth.uid() and not private.is_admin()) then raise exception 'Không có quyền sửa khách này'; end if;
 if r.version<>p_version then raise exception 'Khách đã được cập nhật. Tải lại trước khi lưu.'; end if;
 if length(coalesce(p_note,''))>10000 then raise exception 'Ghi chú quá dài'; end if;
 update public.leads set status=p_status,next_followup=p_next,notes=coalesce(p_note,''),version=version+1,updated_at=now() where id=p_id returning * into r;
 insert into public.activities(lead_id,actor,kind,status,note) values(p_id,auth.uid(),'UPDATE',p_status,coalesce(p_note,''));
 return jsonb_build_object('ok',true,'version',r.version);
end $$;

create function public.crm_create(p_name text,p_phone text,p_project text,p_source text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare lid text;
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập'; end if;
 -- Same phone can be an existing imported record: reject ambiguous new intake.
 perform pg_advisory_xact_lock(hashtextextended(p_phone,0));
 if exists(select 1 from public.leads where phone=p_phone) then raise exception 'Số điện thoại đã có trong hệ thống. Liên hệ quản trị viên.'; end if;
 insert into public.leads(name,phone,project,source,assigned_to) values(btrim(p_name),p_phone,left(p_project,200),left(p_source,200),auth.uid()) returning id into lid;
 insert into public.activities(lead_id,actor,kind) values(lid,auth.uid(),'CREATE');
 return jsonb_build_object('id',lid);
end $$;

create function public.crm_assign(p_ids text[],p_to uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if not private.is_admin() then raise exception 'Chỉ quản trị viên được phân bổ'; end if;
 if coalesce(array_length(p_ids,1),0) not between 1 and 100 then raise exception 'Chọn từ 1 đến 100 khách'; end if;
 if not exists(select 1 from public.profiles where id=p_to and active and role='TELESALES') then raise exception 'Nhân viên không hợp lệ'; end if;
 -- Only unassigned records; concurrent admin actions cannot overwrite assignments.
 with moved as (update public.leads set assigned_to=p_to,updated_at=now(),version=version+1
 where id=any(p_ids) and assigned_to is null returning id)
 insert into public.activities(lead_id,actor,kind,note) select id,auth.uid(),'ASSIGN',p_to::text from moved;
 get diagnostics changed=row_count;
 return jsonb_build_object('count',changed);
end $$;
create function public.crm_prepare_call(p_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('phone',phone,'name',name) into result from public.leads where id=p_id and assigned_to is not null;
 if result is null then raise exception 'Không có quyền gọi khách này'; end if;
 return result;
end $$;
revoke all on function public.crm_profile(),public.crm_leads(text,text,text,timestamptz,text,integer),public.crm_summary(),public.crm_detail(text),public.crm_update(text,bigint,text,date,text),public.crm_create(text,text,text,text),public.crm_assign(text[],uuid),public.crm_prepare_call(text) from public,anon;
grant execute on function public.crm_profile(),public.crm_leads(text,text,text,timestamptz,text,integer),public.crm_summary(),public.crm_detail(text),public.crm_update(text,bigint,text,date,text),public.crm_create(text,text,text,text),public.crm_assign(text[],uuid),public.crm_prepare_call(text) to authenticated;
commit;
