begin;
create table public.callio_calls(
 id text primary key,owner_id uuid references public.profiles(id),
 started_at timestamptz not null,ended_at timestamptz,
 direction text not null,from_number text,to_number text,extension text,
 duration_seconds integer not null default 0,talk_seconds integer not null default 0,
 outcome text,source_data jsonb not null,synced_at timestamptz not null default now()
);
create index callio_calls_time on public.callio_calls(started_at desc,id desc);
create index callio_calls_owner_time on public.callio_calls(owner_id,started_at desc,id desc);
alter table public.callio_calls enable row level security;
revoke all on public.callio_calls from anon,authenticated;
grant select on public.callio_calls to authenticated;
create policy callio_read on public.callio_calls for select to authenticated using(
 (select private.is_staff()) and ((select private.is_admin()) or owner_id=(select auth.uid())));
create table public.callio_sync_state(id text primary key,last_success timestamptz,history_from timestamptz,records bigint,detail text);
alter table public.callio_sync_state enable row level security;
revoke all on public.callio_sync_state from anon,authenticated;
grant select on public.callio_sync_state to authenticated;
create policy sync_admin_read on public.callio_sync_state for select to authenticated using((select private.is_admin()));
create function public.crm_call_report(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare company boolean;result jsonb;
begin
 select role in ('ADMIN','EXECUTIVE') into company from public.profiles where id=auth.uid() and active;
 if company is null then raise exception 'Không có quyền xem báo cáo'; end if;
 if p_from is null or p_to is null or p_from>=p_to then raise exception 'Khoảng thời gian không hợp lệ'; end if;
 with permitted as (select * from public.callio_calls where started_at>=p_from and started_at<p_to and (company or owner_id=auth.uid()))
 select jsonb_build_object('total',count(*),'connected',count(*) filter(where talk_seconds>0),'talk_seconds',coalesce(sum(talk_seconds),0),'duration_seconds',coalesce(sum(duration_seconds),0),
 'daily',(select coalesce(jsonb_agg(t order by t.day),'[]') from (select (started_at at time zone 'Asia/Ho_Chi_Minh')::date as day,count(*) as total,count(*) filter(where talk_seconds>0) as connected,coalesce(sum(talk_seconds),0) as talk_seconds from permitted group by 1) t)) into result from permitted;
 return result;
end $$;
revoke all on function public.crm_call_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.crm_call_report(timestamptz,timestamptz) to authenticated;
commit;
