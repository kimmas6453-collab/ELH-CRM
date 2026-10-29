begin;
create table public.callio_accounts(
 id text primary key,email text not null unique,name text not null,extension text,
 profile_id uuid unique references public.profiles(id),verified_at timestamptz,verified_by uuid references public.profiles(id)
);
alter table public.callio_accounts enable row level security;
revoke all on public.callio_accounts from anon,authenticated;
grant select on public.callio_accounts to authenticated;
create policy callio_accounts_read on public.callio_accounts for select to authenticated using((select private.is_admin()) or ((select private.is_staff()) and profile_id=(select auth.uid())));
create function private.resolve_callio_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select profile_id into new.owner_id from public.callio_accounts where id=case when new.direction='outbound' then new.source_data->'fromUser'->>'_id' else new.source_data->'toUser'->>'_id' end;
 return new;
end $$;
revoke all on function private.resolve_callio_owner() from public,anon,authenticated;
create trigger callio_resolve_owner before insert or update of source_data,direction on public.callio_calls for each row execute function private.resolve_callio_owner();
create function public.crm_link_callio(p_callio_id text,p_profile_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not private.is_admin() then raise exception 'Chỉ ADMIN được ghép tài khoản';end if;
 if p_profile_id is not null and not exists(select 1 from public.profiles where id=p_profile_id and active and role='TELESALES') then raise exception 'Nhân viên không hợp lệ';end if;
 update public.callio_accounts set profile_id=p_profile_id,verified_at=now(),verified_by=auth.uid() where id=p_callio_id;
 if not found then raise exception 'Tài khoản Callio không tồn tại';end if;
 update public.callio_calls set owner_id=p_profile_id where (direction='outbound' and source_data->'fromUser'->>'_id'=p_callio_id) or (direction='inbound' and source_data->'toUser'->>'_id'=p_callio_id);
 get diagnostics n=row_count;
 return jsonb_build_object('updated',n);
end $$;
revoke all on function public.crm_link_callio(text,uuid) from public,anon;
grant execute on function public.crm_link_callio(text,uuid) to authenticated;
commit;
