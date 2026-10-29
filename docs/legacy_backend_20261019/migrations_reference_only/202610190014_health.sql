begin;
create table private.crm_settings(id boolean primary key default true check(id),reminders boolean not null default false);
alter table private.crm_settings enable row level security;
insert into private.crm_settings default values;
revoke all on private.crm_settings from public,anon,authenticated;
alter table public.notifications add column reference text unique;
create function private.daily_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not (select reminders from private.crm_settings where id) then return 0;end if;
 insert into public.notifications(owner_id,kind,title,body,reference)
 select p.id,'FOLLOWUP','Lịch chăm sóc hôm nay','Bạn có '||count(*)||' khách đến hạn hoặc quá hạn cần chăm sóc.','DAILY:'||today||':'||p.id
 from public.profiles p join public.leads l on l.assigned_to=p.id where p.active and p.role='TELESALES' and l.next_followup<=today and l.status not in ('Booking','Không phù hợp') group by p.id
 on conflict(reference) do nothing;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function private.daily_reminders() from public,anon,authenticated,service_role;
create function public.crm_set_reminders(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được cấu hình nhắc việc';end if;
 if p_enabled is null then raise exception 'Trạng thái không hợp lệ';end if;
 update private.crm_settings set reminders=p_enabled where id;
 insert into public.admin_events(actor,kind,detail) values(auth.uid(),'REMINDER_SCHEDULE',jsonb_build_object('enabled',p_enabled,'hour','08:00 Asia/Ho_Chi_Minh'));
end $$;
create function public.crm_health() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xem vận hành';end if;
 return jsonb_build_object('checked_at',now(),'reminders',(select reminders from private.crm_settings where id),'leads',(select count(*) from public.leads),'activities',(select count(*) from public.activities),'archived',(select count(*) from public.legacy_archive),'sync',(select to_jsonb(s) from public.callio_sync_state s where id='callio'),'batches',(select coalesce(jsonb_agg(t order by t.created_at desc),'[]') from (select id,created_at,result from public.allocation_batches order by created_at desc limit 20) t));
end $$;
create function public.crm_quality() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xem chất lượng kho';end if;
 with pool as(select id,name,phone,project,source,count(*) over(partition by phone) as same_phone from public.leads where assigned_to is null)
 select jsonb_build_object('total',count(*),'invalid_phone',count(*) filter(where phone<>'' and phone !~ '^0[0-9]{9}$'),'missing_phone',count(*) filter(where phone=''),'duplicate_phone',count(*) filter(where phone<>'' and same_phone>1),'missing_project',count(*) filter(where btrim(project)=''),'missing_source',count(*) filter(where btrim(source)=''),'samples',(select coalesce(jsonb_agg(s),'[]') from (select * from pool where phone !~ '^0[0-9]{9}$' or same_phone>1 or btrim(project)='' or btrim(source)='' order by id limit 50) s)) into result from pool;
 return result;
end $$;
revoke all on function public.crm_set_reminders(boolean),public.crm_health(),public.crm_quality() from public,anon;
grant execute on function public.crm_set_reminders(boolean),public.crm_health(),public.crm_quality() to authenticated;
commit;
