begin;
create function public.crm_import_pool(p_rows jsonb,p_preview boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; n integer:=0; duplicates integer:=0; seen text[]:='{}'; v_phone text; lid text;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được nhập dữ liệu';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Mỗi lần nhập từ 1 đến 500 dòng';end if;
 if p_preview is null then raise exception 'Chế độ không hợp lệ';end if;
 for r in select value from jsonb_array_elements(p_rows) order by value->>'phone' loop
  v_phone:=r->>'phone';
  if v_phone is null or v_phone !~ '^0[0-9]{9}$' or length(btrim(coalesce(r->>'name',''))) not between 1 and 200 then raise exception 'Tên hoặc số điện thoại không hợp lệ';end if;
  if length(coalesce(r->>'notes',''))>10000 then raise exception 'Ghi chú quá dài';end if;
  if not p_preview then perform pg_advisory_xact_lock(hashtextextended(v_phone,0));end if;
  if v_phone=any(seen) or exists(select 1 from public.leads l where l.phone=v_phone) then duplicates:=duplicates+1;continue;end if;
  seen:=array_append(seen,v_phone);n:=n+1;
  if not p_preview then
   insert into public.leads(name,phone,project,source,notes) values(btrim(r->>'name'),v_phone,left(coalesce(r->>'project',''),200),left(coalesce(r->>'source',''),200),coalesce(r->>'notes','')) returning id into lid;
   insert into public.activities(lead_id,actor,kind) values(lid,auth.uid(),'IMPORT');
  end if;
 end loop;
 if not p_preview then insert into public.admin_events(actor,kind,detail) values(auth.uid(),'IMPORT',jsonb_build_object('inserted',n,'duplicates',duplicates));end if;
 return jsonb_build_object('inserted',n,'duplicates',duplicates,'preview',p_preview);
end $$;
revoke all on function public.crm_import_pool(jsonb,boolean) from public,anon;
grant execute on function public.crm_import_pool(jsonb,boolean) to authenticated;
commit;
