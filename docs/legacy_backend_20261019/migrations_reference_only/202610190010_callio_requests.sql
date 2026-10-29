begin;
create table public.callio_link_requests(profile_id uuid primary key references public.profiles(id),callio_id text not null references public.callio_accounts(id),status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references public.profiles(id));
alter table public.callio_link_requests enable row level security;
revoke all on public.callio_link_requests from anon,authenticated;
grant select on public.callio_link_requests to authenticated;
create policy link_requests_read on public.callio_link_requests for select to authenticated using((select private.is_admin()) or ((select private.is_staff()) and profile_id=(select auth.uid())));
create function public.crm_request_callio_link(p_email text) returns void language plpgsql security definer set search_path='' as $$
declare cid text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='TELESALES' and active) then raise exception 'Chức năng dành cho nhân viên telesales';end if;
 if exists(select 1 from public.callio_accounts where profile_id=auth.uid()) then raise exception 'Tài khoản đã ghép. Liên hệ quản trị nếu cần đổi.';end if;
 select id into cid from public.callio_accounts where lower(email)=lower(btrim(p_email)) and (profile_id is null or profile_id=auth.uid());
 if cid is null then raise exception 'Chưa thể gửi yêu cầu với email này. Liên hệ quản trị kiểm tra tài khoản Callio.';end if;
 insert into public.callio_link_requests(profile_id,callio_id) values(auth.uid(),cid) on conflict(profile_id) do update set callio_id=excluded.callio_id,status='pending',created_at=now(),reviewed_at=null,reviewed_by=null;
end $$;
create function public.crm_review_callio_link(p_profile uuid,p_callio text,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare mapped uuid;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được xác nhận';end if;
 if p_approve is null then raise exception 'Quyết định không hợp lệ';end if;
 perform 1 from public.callio_link_requests where profile_id=p_profile and callio_id=p_callio and status='pending' for update;
 if not found then raise exception 'Yêu cầu đã thay đổi. Tải lại trước khi xác nhận.';end if;
 if p_approve then
 select profile_id into mapped from public.callio_accounts where id=p_callio for update;
 if mapped is not null and mapped<>p_profile then raise exception 'Callio đã ghép với nhân viên khác';end if;
 perform public.crm_link_callio(p_callio,p_profile);
 end if;
 update public.callio_link_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid() where profile_id=p_profile;
 insert into public.admin_events(actor,kind,target,detail) values(auth.uid(),'CALLIO_LINK_REVIEW',p_profile,jsonb_build_object('callio_id',p_callio,'approved',p_approve));
end $$;
revoke all on function public.crm_request_callio_link(text),public.crm_review_callio_link(uuid,text,boolean) from public,anon;
grant execute on function public.crm_request_callio_link(text),public.crm_review_callio_link(uuid,text,boolean) to authenticated;
commit;
