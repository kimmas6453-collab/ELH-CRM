-- Restore team operations with bounded, authorized server queries.
begin;
create or replace function public.crm_update(p_id text,p_version bigint,p_status text,p_next date,p_note text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.leads;
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập'; end if;
 select * into r from public.leads where id=p_id for update;
 if not found or (r.assigned_to is distinct from auth.uid() and not private.is_admin()) then raise exception 'Không có quyền sửa khách này'; end if;
 if r.version<>p_version then raise exception 'Khách đã được cập nhật. Tải lại trước khi lưu.'; end if;
 if length(coalesce(p_note,''))>10000 then raise exception 'Ghi chú quá dài'; end if;
 update public.leads set status=p_status,next_followup=p_next,notes=coalesce(p_note,''),version=version+1,updated_at=now(),last_contact=now() where id=p_id returning * into r;
 insert into public.activities(lead_id,actor,kind,status,note,next_followup) values(p_id,auth.uid(),'UPDATE',p_status,coalesce(p_note,''),p_next);
 return jsonb_build_object('ok',true,'version',r.version);
end $$;
create or replace function public.crm_team() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được quản lý đội ngũ';end if;
 select jsonb_build_object('members',(select coalesce(jsonb_agg(t),'[]') from(
 select p.id,p.name,p.email,p.role,p.active,count(l.id) as assigned,
 count(l.id) filter(where l.status in ('Mới','Chưa liên hệ')) as pending,
 count(l.id) filter(where l.status not in ('Mới','Chưa liên hệ')) as contacted,
 count(l.id) filter(where l.status in ('Có nhu cầu','Hẹn gặp','Đang tư vấn')) as interested,
 count(l.id) filter(where l.next_followup<today and l.status not in ('Booking','Không phù hợp')) as overdue,
 count(l.id) filter(where l.next_followup<=today and l.status not in ('Booking','Không phù hợp')) as due,
 count(l.id) filter(where l.status='Booking') as booking,max(l.last_contact) as last_contact,
 round(100.0*count(l.id) filter(where l.status not in ('Mới','Chưa liên hệ'))/nullif(count(l.id),0),1) as coverage
 from public.profiles p left join public.leads l on l.assigned_to=p.id group by p.id order by p.role,p.email) t),
 'pool',(select count(*) from public.leads where assigned_to is null),
 'invalid_phones',(select count(*) from public.leads where phone !~ '^0[0-9]{9}$'),
 'sync',(select to_jsonb(s) from public.callio_sync_state s where id='callio'),
 'unmapped_calls',(select count(*) from public.callio_calls where owner_id is null)) into result;
 return result;
end $$;
create function public.crm_staff360(p_id uuid,p_mode text default 'all',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xem hồ sơ đội ngũ';end if;
 if p_mode not in ('all','pending','overdue','due','booking') or p_offset<0 then raise exception 'Bộ lọc không hợp lệ';end if;
 with matches as (select id,name,phone,project,status,next_followup,last_contact,created_at from public.leads where assigned_to=p_id and case p_mode
 when 'pending' then status in ('Mới','Chưa liên hệ') when 'overdue' then next_followup<today and status not in ('Booking','Không phù hợp')
 when 'due' then next_followup<=today and status not in ('Booking','Không phù hợp') when 'booking' then status='Booking' else true end),
 page as(select * from matches order by created_at desc,id desc limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matches),'items',(select coalesce(jsonb_agg(p order by p.created_at desc,p.id desc),'[]') from page p)) into result;return result;
end $$;
create function public.crm_admin_history(p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xem nhật ký';end if;
 if p_offset<0 then raise exception 'Trang không hợp lệ';end if;
 select coalesce(jsonb_agg(t order by t.created_at desc,t.id desc),'[]') into result from
 (select a.id,a.kind,a.detail,a.created_at,p.name as actor,q.name as target from public.admin_events a join public.profiles p on p.id=a.actor left join public.profiles q on q.id=a.target order by a.created_at desc,a.id desc limit 50 offset p_offset) t;
 return result;
end $$;
create table public.allocation_batches(id uuid primary key,actor uuid not null references public.profiles(id),plan jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table public.allocation_batches enable row level security;
revoke all on public.allocation_batches from anon,authenticated;
grant select on public.allocation_batches to authenticated;
create policy allocation_admin_read on public.allocation_batches for select to authenticated using((select private.is_admin()));
create function public.crm_allocate_batch(p_plan jsonb,p_preview boolean default true,p_key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb; staff uuid; amount integer; total integer:=0; pool integer; lid text; assigned integer:=0; saved public.allocation_batches; result jsonb;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được phân bổ';end if;
 if p_plan is null or p_preview is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan) not between 1 and 50 then raise exception 'Kế hoạch không hợp lệ';end if;
 if not p_preview and p_key is null then raise exception 'Thiếu mã lần phân bổ';end if;
 -- Serialize pool allocation and idempotent retries, including competing admins.
 perform pg_advisory_xact_lock(hashtextextended('crm_allocate_batch',0));
 if not p_preview then
 select * into saved from public.allocation_batches where id=p_key;
 if found then
 if saved.actor<>auth.uid() or saved.plan<>p_plan then raise exception 'Mã lần phân bổ đã dùng';end if;
 return saved.result;
 end if;end if;
 if (select count(distinct x->>'staff') from jsonb_array_elements(p_plan) x)<>jsonb_array_length(p_plan) then raise exception 'Nhân viên bị lặp';end if;
 for row in select value from jsonb_array_elements(p_plan) loop
 staff:=(row->>'staff')::uuid;amount:=(row->>'count')::integer;
 if amount is null or amount not between 1 and 500 then raise exception 'Mỗi nhân viên nhận từ 1 đến 500 khách';end if;
 perform 1 from public.profiles where id=staff and active and role='TELESALES' for share;
 if not found then raise exception 'Nhân viên không hợp lệ hoặc đã khóa';end if;
 total:=total+amount;
 end loop;
 if total>500 then raise exception 'Tối đa 500 khách mỗi lần';end if;
 select count(*) into pool from public.leads where assigned_to is null;
 if pool<total then raise exception 'Kho không đủ khách: còn %',pool;end if;
 if p_preview then return jsonb_build_object('requested',total,'available',pool,'plan',p_plan);end if;
 for row in select value from jsonb_array_elements(p_plan) loop
 staff:=(row->>'staff')::uuid;amount:=(row->>'count')::integer;
 for lid in select id from public.leads where assigned_to is null order by created_at,id limit amount for update skip locked loop
 update public.leads set assigned_to=staff,updated_at=now(),version=version+1 where id=lid;
 insert into public.activities(lead_id,actor,kind,note) values(lid,auth.uid(),'ASSIGN',staff::text);
 assigned:=assigned+1;
 end loop;
 end loop;
 if assigned<>total then raise exception 'Kho đang được cập nhật. Xem trước lại kế hoạch.';end if;
 result:=jsonb_build_object('count',assigned,'id',p_key,'plan',p_plan);
 insert into public.allocation_batches(id,actor,plan,result) values(p_key,auth.uid(),p_plan,result);
 insert into public.admin_events(actor,kind,detail) values(auth.uid(),'ASSIGN_BATCH',result);
 return result;
end $$;
revoke all on function public.crm_staff360(uuid,text,integer),public.crm_admin_history(integer),public.crm_allocate_batch(jsonb,boolean,uuid) from public,anon;
grant execute on function public.crm_staff360(uuid,text,integer),public.crm_admin_history(integer),public.crm_allocate_batch(jsonb,boolean,uuid) to authenticated;
commit;
