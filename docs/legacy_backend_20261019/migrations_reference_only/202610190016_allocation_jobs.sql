begin;
create table public.allocation_jobs(id uuid primary key,actor uuid not null references public.profiles(id),request jsonb not null,state text not null default 'PENDING' check(state in ('PENDING','RUNNING','DONE')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.allocation_job_items(job_id uuid references public.allocation_jobs(id),seq integer,lead_id text not null references public.leads(id),owner_id uuid not null references public.profiles(id),state text not null default 'PENDING' check(state in ('PENDING','ASSIGNED','SKIPPED')),primary key(job_id,seq),unique(job_id,lead_id));
alter table public.allocation_jobs enable row level security;alter table public.allocation_job_items enable row level security;
revoke all on public.allocation_jobs,public.allocation_job_items from anon,authenticated;
grant select on public.allocation_jobs,public.allocation_job_items to authenticated;
create policy jobs_admin_read on public.allocation_jobs for select to authenticated using((select private.is_admin()));
create policy job_items_admin_read on public.allocation_job_items for select to authenticated using((select private.is_admin()));
create function private.allocation_plan(p_request jsonb) returns table(seq integer,lead_id text,owner_id uuid) language plpgsql security definer set search_path='' as $$
declare people uuid[];loads bigint[];row record;i integer;chosen integer;n integer:=0;f jsonb:=coalesce(p_request->'filters','{}');policy text:=p_request->>'policy';
begin
 if p_request is null or jsonb_typeof(p_request->'recipients')<>'array' or jsonb_array_length(p_request->'recipients') not between 1 and 30 or policy not in ('equal','workload') or policy is null then raise exception 'Kế hoạch không hợp lệ';end if;
 select array_agg(value::uuid order by ordinality) into people from jsonb_array_elements_text(p_request->'recipients') with ordinality;
 if (select count(distinct x) from unnest(people) x)<>array_length(people,1) then raise exception 'Nhân viên bị lặp';end if;
 foreach owner_id in array people loop
 perform 1 from public.profiles where id=owner_id and active and role='TELESALES' for share;
 if not found then raise exception 'Nhân viên đã khóa hoặc không hợp lệ';end if;
 loads:=array_append(loads,(select count(*) from public.leads l where l.assigned_to=owner_id));
 end loop;
 if p_request ? 'ids' and (jsonb_typeof(p_request->'ids')<>'array' or jsonb_array_length(p_request->'ids') not between 1 and 15000) then raise exception 'Danh sách khách không hợp lệ';end if;
 for row in select l.id from public.leads l where l.assigned_to is null
 and (coalesce(f->>'q','')='' or strpos(l.search_folded,private.fold_text(f->>'q'))>0)
 and (coalesce(f->>'project','')='' or strpos(private.fold_text(l.project),private.fold_text(f->>'project'))>0)
 and (coalesce(f->>'source','')='' or strpos(private.fold_text(l.source),private.fold_text(f->>'source'))>0)
 and case coalesce(f->>'quality','') when 'valid' then l.phone ~ '^0[0-9]{9}$' when 'review' then l.phone !~ '^0[0-9]{9}$' else true end
 and (not(p_request ? 'ids') or l.id in(select jsonb_array_elements_text(p_request->'ids')))
 order by l.created_at,l.id limit 15001 loop
 n:=n+1;if n>15000 then raise exception 'Tối đa 15.000 khách mỗi job. Thu hẹp bộ lọc.';end if;
 chosen:=1;if policy='equal' then chosen:=((n-1)%array_length(people,1))+1;else
 for i in 2..array_length(people,1) loop if loads[i]<loads[chosen] then chosen:=i;end if;end loop;
 end if;
 loads[chosen]:=loads[chosen]+1;seq:=n;lead_id:=row.id;owner_id:=people[chosen];return next;
 end loop;
 if n=0 then raise exception 'Không có khách chưa giao phù hợp';end if;
end $$;
revoke all on function private.allocation_plan(jsonb) from public,anon,authenticated;
create function public.crm_job_preview(p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được phân bổ';end if;
 select jsonb_build_object('total',sum(t.amount),'workers',jsonb_agg(t)) into result from(select x.owner_id,p.name,count(*) as amount from private.allocation_plan(p_request) x join public.profiles p on p.id=x.owner_id group by x.owner_id,p.name) t;return result;
end $$;
create function public.crm_job_create(p_request jsonb,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.allocation_jobs;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được phân bổ';end if;
 if p_key is null then raise exception 'Thiếu mã job';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into old from public.allocation_jobs where id=p_key;
 if found then if old.actor<>auth.uid() or old.request<>p_request then raise exception 'Mã job đã được dùng';end if;return p_key;end if;
 insert into public.allocation_jobs(id,actor,request) values(p_key,auth.uid(),p_request);
 insert into public.allocation_job_items(job_id,seq,lead_id,owner_id) select p_key,x.seq,x.lead_id,x.owner_id from private.allocation_plan(p_request) x;
 insert into public.admin_events(actor,kind,detail) values(auth.uid(),'ALLOCATION_JOB_CREATE',jsonb_build_object('job',p_key));return p_key;
end $$;
create function public.crm_job_status(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xem job';end if;
 return(select jsonb_build_object('id',j.id,'state',j.state,'created_at',j.created_at,'total',count(*),'assigned',count(*) filter(where i.state='ASSIGNED'),'skipped',count(*) filter(where i.state='SKIPPED'),'pending',count(*) filter(where i.state='PENDING')) from public.allocation_jobs j join public.allocation_job_items i on i.job_id=j.id where j.id=p_id group by j.id);
end $$;
create function public.crm_job_step(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare row record;n integer;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được thực hiện job';end if;
 perform 1 from public.allocation_jobs where id=p_id for update;
 if not found then raise exception 'Không tìm thấy job';end if;
 for row in select * from public.allocation_job_items where job_id=p_id and state='PENDING' order by seq limit 120 loop
 perform 1 from public.profiles where id=row.owner_id and active and role='TELESALES' for share;
 if not found then raise exception 'Nhân viên trong job đã khóa. Kiểm tra tài khoản trước khi tiếp tục.';end if;
 update public.leads set assigned_to=row.owner_id,version=version+1,updated_at=now() where id=row.lead_id and assigned_to is null;
 get diagnostics n=row_count;
 if n=1 then insert into public.activities(lead_id,actor,kind,note) values(row.lead_id,auth.uid(),'ASSIGN',row.owner_id::text);end if;
 update public.allocation_job_items set state=case when n=1 then 'ASSIGNED' else 'SKIPPED' end where job_id=p_id and seq=row.seq;
 end loop;
 update public.allocation_jobs set state=case when exists(select 1 from public.allocation_job_items where job_id=p_id and state='PENDING') then 'RUNNING' else 'DONE' end,updated_at=now() where id=p_id;
 return public.crm_job_status(p_id);
end $$;
revoke all on function public.crm_job_preview(jsonb),public.crm_job_create(jsonb,uuid),public.crm_job_status(uuid),public.crm_job_step(uuid) from public,anon;
grant execute on function public.crm_job_preview(jsonb),public.crm_job_create(jsonb,uuid),public.crm_job_status(uuid),public.crm_job_step(uuid) to authenticated;
commit;
