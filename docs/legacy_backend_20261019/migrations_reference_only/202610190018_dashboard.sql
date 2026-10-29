begin;
create function private.dashboard_calls(p_from timestamptz,p_to timestamptz,p_agent text,p_direction text,p_network text)
returns setof public.callio_calls language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 select role into r from public.profiles where id=auth.uid() and active;
 if r is null then raise exception 'Không có quyền truy cập';end if;
 if p_from is null or p_to is null or p_from>=p_to or p_to-p_from>interval '366 days' then raise exception 'Chọn khoảng ngày không quá 366 ngày';end if;
 if p_direction not in ('','inbound','outbound') then raise exception 'Hướng gọi không hợp lệ';end if;
 return query select c.* from public.callio_calls c where c.started_at>=p_from and c.started_at<p_to
 and (r in ('ADMIN','EXECUTIVE') or c.owner_id=auth.uid())
 and (p_agent='' or case when c.direction='outbound' then c.source_data->'fromUser'->>'_id' else c.source_data->'toUser'->>'_id' end=p_agent)
 and (p_direction='' or c.direction=p_direction) and (p_network='' or c.source_data->>'network'=p_network);
end $$;
revoke all on function private.dashboard_calls(timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
create function public.crm_dashboard(p_from timestamptz,p_to timestamptz,p_agent text default '',p_direction text default '',p_network text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;role_name text;
begin
 select role into role_name from public.profiles where id=auth.uid() and active;
 with c as materialized (select c.*, coalesce(nullif(case when direction='outbound' then to_number else from_number end,''),'') phone,
 coalesce(nullif(case when direction='outbound' then source_data->'fromUser'->>'_id' else source_data->'toUser'->>'_id' end,''),'unknown') agent,
 case when jsonb_typeof(source_data->'transcripts')='array' then jsonb_array_length(source_data->'transcripts')>0 else false end voice
 from private.dashboard_calls(p_from,p_to,p_agent,p_direction,p_network) c),
 a as (select agent,count(*) total,count(*) filter(where talk_seconds>0) connected,count(*) filter(where talk_seconds>=30) meaningful,count(*) filter(where voice) transcripts,coalesce(sum(talk_seconds),0) seconds,
 count(*) filter(where talk_seconds=0) failed,count(*) filter(where talk_seconds between 1 and 9) short,count(*) filter(where talk_seconds between 10 and 29) medium from c group by agent),
 l as materialized (select * from public.leads where (role_name in ('ADMIN','EXECUTIVE') or assigned_to=auth.uid()) and (p_agent='' or assigned_to=(select profile_id from public.callio_accounts where id=p_agent))),
 phones as (select phone,count(*) n,bool_or(talk_seconds>0) connected,bool_or(talk_seconds>=30) meaningful from c where phone<>'' group by phone)
 select jsonb_build_object(
 'totals',(select jsonb_build_object('total',count(*),'connected',count(*) filter(where talk_seconds>0),'meaningful',count(*) filter(where talk_seconds>=30),'ten',count(*) filter(where talk_seconds>=10),'transcripts',count(*) filter(where voice),'seconds',coalesce(sum(talk_seconds),0),'outbound',count(*) filter(where direction='outbound'),'unmapped',count(*) filter(where owner_id is null),'unique',count(distinct nullif(phone,'')),'repeat',(select count(*) from phones where n>1),'cost',sum(case when jsonb_typeof(source_data->'chargedFee')='number' then (source_data->>'chargedFee')::numeric else null end),'cost_rows',count(*) filter(where jsonb_typeof(source_data->'chargedFee')='number')) from c),
 'daily',(select coalesce(jsonb_agg(d order by d.day),'[]') from (select (started_at at time zone 'Asia/Ho_Chi_Minh')::date as day,count(*) total,count(*) filter(where talk_seconds>0) connected from c group by 1)d),
 'hours',(select coalesce(jsonb_agg(d order by d.hour),'[]') from (select extract(hour from started_at at time zone 'Asia/Ho_Chi_Minh')::int as hour,count(*) total,count(*) filter(where talk_seconds>0) connected from c group by 1)d),
 'reasons',(select coalesce(jsonb_agg(d order by d.total desc),'[]') from(select coalesce(outcome,'Không xác định') label,count(*) total from c group by 1)d),
 'networks',(select coalesce(jsonb_agg(d order by d.total desc),'[]') from(select coalesce(nullif(source_data->>'network',''),'Không xác định') label,count(*) total,count(*) filter(where talk_seconds>0) connected from c group by 1)d),
 'team',(select coalesce(jsonb_agg(d order by d.total desc),'[]') from(select a.*,coalesce(ca.name,'Chưa xác định') name,ca.extension from a left join public.callio_accounts ca on ca.id=a.agent)d),
 'crm',(select jsonb_build_object('total',count(*),'assigned',count(*) filter(where assigned_to is not null),'interested',count(*) filter(where status in ('Có nhu cầu','Đang tư vấn')),'appointment',count(*) filter(where status='Hẹn gặp'),'booking',count(*) filter(where status='Booking'),'followup',count(*) filter(where next_followup is not null and status not in ('Booking','Không phù hợp')),'overdue',count(*) filter(where next_followup<(now() at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('Booking','Không phù hợp'))) from l),
 'agents',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'extension',extension) order by extension),'[]') from public.callio_accounts where role_name in ('ADMIN','EXECUTIVE') or profile_id=auth.uid()),
 'last_sync',(select last_success from public.callio_sync_state where id='callio'), 'generated_at',now()) into result;
 return result;
end $$;
revoke all on function public.crm_dashboard(timestamptz,timestamptz,text,text,text) from public,anon;
grant execute on function public.crm_dashboard(timestamptz,timestamptz,text,text,text) to authenticated;
create function public.crm_dashboard_calls(p_from timestamptz,p_to timestamptz,p_agent text default '',p_direction text default '',p_network text default '',p_preset text default '',p_before timestamptz default null,p_id text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','TELESALES')) then raise exception 'Không có quyền xem chi tiết';end if;
 if p_preset not in ('','failed','short','meaningful','voice') then raise exception 'Bộ lọc không hợp lệ';end if;
 if (p_before is null)<>(p_id is null) then raise exception 'Cursor không hợp lệ';end if;
 with c as (select * from private.dashboard_calls(p_from,p_to,p_agent,p_direction,p_network)),page as (
 select c.id,c.started_at,c.direction,c.talk_seconds,c.duration_seconds,c.outcome,case when c.direction='outbound' then c.to_number else c.from_number end phone,
 coalesce(a.name,'Chưa xác định') agent,coalesce(c.source_data->>'network','') network,
 case when jsonb_typeof(c.source_data->'transcripts')='array' then jsonb_array_length(c.source_data->'transcripts')>0 else false end voice
 from c left join public.callio_accounts a on a.id=case when c.direction='outbound' then c.source_data->'fromUser'->>'_id' else c.source_data->'toUser'->>'_id' end
 where (p_before is null or (c.started_at,c.id)<(p_before,p_id)) and case p_preset when 'failed' then c.talk_seconds=0 when 'short' then c.talk_seconds between 1 and 9 when 'meaningful' then c.talk_seconds>=30 when 'voice' then jsonb_typeof(c.source_data->'transcripts')='array' and c.source_data->'transcripts'<>'[]'::jsonb else true end
 order by c.started_at desc,c.id desc limit 51)
 select coalesce(jsonb_agg(page order by started_at desc,id desc),'[]') into result from page;
 return jsonb_build_object('items',case when jsonb_array_length(result)>50 then result-50 else result end,'hasMore',jsonb_array_length(result)>50);
end $$;
revoke all on function public.crm_dashboard_calls(timestamptz,timestamptz,text,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.crm_dashboard_calls(timestamptz,timestamptz,text,text,text,text,timestamptz,text) to authenticated;
create function public.crm_call_transcript(p_id text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('id',id,'transcripts',coalesce(source_data->'transcripts','[]'::jsonb)) into result from public.callio_calls where id=p_id;
 if result is null then raise exception 'Không có quyền xem cuộc gọi';end if;
 return result;
end $$;
revoke all on function public.crm_call_transcript(text) from public,anon;
grant execute on function public.crm_call_transcript(text) to authenticated;
commit;

