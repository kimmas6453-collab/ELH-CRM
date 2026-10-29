begin;
create function public.crm_daily_queue(p_mode text default 'today',p_query text default '',p_offset integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not private.is_staff() then raise exception 'Không có quyền truy cập';end if;
 if p_mode not in ('all','today','overdue','pending','new','hot') or p_offset<0 or length(p_query)>150 then raise exception 'Bộ lọc không hợp lệ';end if;
 with own as(select id,name,phone,project,status,next_followup,created_at,search_folded,
 case when status in ('Booking','Không phù hợp') then 0 else
 (case when next_followup<today then 80 when next_followup=today then 60 else 0 end)+
 (case when status in ('Có nhu cầu','Hẹn gặp','Đang tư vấn') then 30 else 0 end)+
 (case when (created_at at time zone 'Asia/Ho_Chi_Minh')::date=today then 20 else 0 end)+
 (case when status in ('Mới','Chưa liên hệ') then 10 else 0 end) end as score
 from public.leads where assigned_to is not null),
 filtered as(select * from own where (coalesce(p_query,'')='' or strpos(search_folded,private.fold_text(p_query))>0) and case p_mode
 when 'today' then next_followup=today and status not in ('Booking','Không phù hợp') when 'overdue' then next_followup<today and status not in ('Booking','Không phù hợp')
 when 'pending' then status in ('Mới','Chưa liên hệ') when 'new' then (created_at at time zone 'Asia/Ho_Chi_Minh')::date=today
 when 'hot' then status in ('Có nhu cầu','Hẹn gặp','Đang tư vấn') else true end),
 page as(select id,name,phone,project,status,next_followup,created_at,score from filtered order by score desc,next_followup asc nulls last,created_at desc,id limit 30 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'items',(select coalesce(jsonb_agg(p order by p.score desc,p.next_followup asc nulls last,p.created_at desc,p.id),'[]') from page p)) into result;return result;
end $$;
revoke all on function public.crm_daily_queue(text,text,integer) from public,anon;
grant execute on function public.crm_daily_queue(text,text,integer) to authenticated;
commit;
