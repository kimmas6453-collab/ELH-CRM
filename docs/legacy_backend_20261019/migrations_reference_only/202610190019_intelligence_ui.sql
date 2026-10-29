begin;
create function public.crm_intelligence_page(p_from timestamptz,p_to timestamptz,p_before timestamptz default null,p_id text default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','TELESALES')) then raise exception 'Không có quyền xem chi tiết';end if;
 if p_from is null or p_to is null or p_from>=p_to or p_to-p_from>interval '366 days' then raise exception 'Khoảng ngày không hợp lệ';end if;
 if (p_before is null)<>(p_id is null) then raise exception 'Cursor không hợp lệ';end if;
 with page as (select c.id,c.started_at,c.direction,c.from_number,c.to_number,c.talk_seconds,c.duration_seconds,c.outcome,
 coalesce(a.name,'Inbound') agent,coalesce(a.email,'') email,coalesce(a.extension,c.extension) extension,
 coalesce(c.source_data->>'network','') network,
 case when jsonb_typeof(c.source_data->'chargedFee')='number' then (c.source_data->>'chargedFee')::numeric else null end cost,
 case when jsonb_typeof(c.source_data->'transcripts')='array' then c.source_data->'transcripts' else '[]'::jsonb end transcripts
 from public.callio_calls c left join public.callio_accounts a on a.id=case when c.direction='outbound' then c.source_data->'fromUser'->>'_id' else c.source_data->'toUser'->>'_id' end
 where c.started_at>=p_from and c.started_at<p_to and (p_before is null or (c.started_at,c.id)<(p_before,p_id)) order by c.started_at desc,c.id desc limit 301)
 select coalesce(jsonb_agg(page order by started_at desc,id desc),'[]') into result from page;
 return jsonb_build_object('items',case when jsonb_array_length(result)>300 then result-300 else result end,'hasMore',jsonb_array_length(result)>300);
end $$;
revoke all on function public.crm_intelligence_page(timestamptz,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.crm_intelligence_page(timestamptz,timestamptz,timestamptz,text) to authenticated;
create function public.crm_intelligence_leads(p_phones text[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if cardinality(p_phones)>500 then raise exception 'Tối đa 500 số mỗi lần';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'phone',phone,'status',status,'project',project,'next',next_followup,'note',notes,'version',version)),'[]') into result from public.leads where phone=any(p_phones);
 return result;
end $$;
revoke all on function public.crm_intelligence_leads(text[]) from public,anon;
grant execute on function public.crm_intelligence_leads(text[]) to authenticated;
commit;
