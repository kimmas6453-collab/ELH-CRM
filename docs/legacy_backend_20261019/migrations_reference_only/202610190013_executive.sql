begin;
create or replace function public.crm_executive_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('ADMIN','EXECUTIVE')) then raise exception 'Không có quyền xem báo cáo'; end if;
 select jsonb_build_object('assigned',count(*) filter(where assigned_to is not null),'pool',count(*) filter(where assigned_to is null),
 'pending',count(*) filter(where assigned_to is not null and status in ('Mới','Chưa liên hệ')),
 'booking',count(*) filter(where assigned_to is not null and status='Booking'),
 'due',count(*) filter(where assigned_to is not null and next_followup<=(now() at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('Booking','Không phù hợp')),
 'overdue',count(*) filter(where assigned_to is not null and next_followup<(now() at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('Booking','Không phù hợp')),
 'active_telesales',(select count(*) from public.profiles where active and role='TELESALES'),
 'team',(select coalesce(jsonb_agg(t),'[]') from (
 select p.name,p.active,count(l.id) as total,count(l.id) filter(where l.status not in ('Mới','Chưa liên hệ')) as contacted,
 count(l.id) filter(where l.next_followup<=(now() at time zone 'Asia/Ho_Chi_Minh')::date and l.status not in ('Booking','Không phù hợp')) as due,
 count(l.id) filter(where l.next_followup<(now() at time zone 'Asia/Ho_Chi_Minh')::date and l.status not in ('Booking','Không phù hợp')) as overdue,
 count(l.id) filter(where l.status='Booking') as booking from public.profiles p left join public.leads l on l.assigned_to=p.id
 where p.role='TELESALES' group by p.id order by p.name) t)) into result from public.leads;
 return result;
end $$;

commit;
