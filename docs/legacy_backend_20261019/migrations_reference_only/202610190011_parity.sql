begin;
create function private.fold_text(p_text text) returns text language sql immutable strict parallel safe set search_path='' as $$select translate(lower(p_text),'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ','aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')$$;
revoke all on function private.fold_text(text) from public,anon;grant usage on schema private to service_role;grant execute on function private.fold_text(text) to authenticated,service_role;
alter table public.leads add column search_folded text generated always as (private.fold_text(name||' '||phone||' '||project)) stored;
create or replace function public.crm_leads(p_query text default '', p_status text default '', p_mode text default 'all',
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
 and (btrim(p_query)='' or search_folded like '%' || replace(replace(replace(private.fold_text(btrim(p_query)),chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_') || '%')
 and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id))
 and case p_mode
 when 'pool' then assigned_to is null
 when 'today' then next_followup=today and status not in ('Booking','Không phù hợp')
 when 'overdue' then next_followup<today and status not in ('Booking','Không phù hợp')
 when 'pending' then status in ('Mới','Chưa liên hệ')
 when 'hot' then status in ('Có nhu cầu','Hẹn gặp','Đang tư vấn')
 when 'booking' then status='Booking' else assigned_to is not null end
 order by created_at desc,id desc limit lim+1
 ) select coalesce(jsonb_agg(to_jsonb(page) order by created_at desc,id desc),'[]') into result from page;
 return jsonb_build_object('items',case when jsonb_array_length(result)>lim then result-lim else result end,'hasMore',jsonb_array_length(result)>lim);
end $$;


create or replace function public.crm_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('total',count(*),'pending',count(*) filter(where status in ('Mới','Chưa liên hệ')),
 'today',count(*) filter(where next_followup=(now() at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('Booking','Không phù hợp')),
 'booking',count(*) filter(where status='Booking')) from public.leads where assigned_to is not null;
$$;
create function public.crm_intake(p_name text,p_phone text,p_project text,p_source text,p_next date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.crm_create(p_name,p_phone,p_project,p_source);
 update public.leads set next_followup=p_next where id=result->>'id';
 update public.activities set next_followup=p_next where lead_id=result->>'id' and kind='CREATE';
 return result;
end $$;
create function public.crm_duplicate(p_phone text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập';end if;
 if p_phone is null or p_phone !~ '^0[0-9]{9}$' then raise exception 'Số điện thoại không hợp lệ';end if;
 return exists(select 1 from public.leads where phone=p_phone);
end $$;
create function public.crm_activity_page(p_id text,p_offset integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_offset<0 then raise exception 'Trang không hợp lệ';end if;
 select coalesce(jsonb_agg(t order by t.created_at desc,t.id desc),'[]') into result from
 (select id,kind,status,note,next_followup,created_at from public.activities where lead_id=p_id order by created_at desc,id desc limit 50 offset p_offset) t;
 return result;
end $$;
revoke all on function public.crm_intake(text,text,text,text,date),public.crm_duplicate(text),public.crm_activity_page(text,integer) from public,anon;
grant execute on function public.crm_intake(text,text,text,text,date),public.crm_duplicate(text),public.crm_activity_page(text,integer) to authenticated;
commit;
