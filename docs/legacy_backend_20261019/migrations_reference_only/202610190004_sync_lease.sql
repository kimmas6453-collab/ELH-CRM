begin;
create table private.callio_sync_lease(id boolean primary key default true check(id),lease uuid,expires timestamptz);
alter table private.callio_sync_lease enable row level security;
revoke all on private.callio_sync_lease from public,anon,authenticated;
insert into private.callio_sync_lease(id) values(true);
create function public.claim_callio_sync(p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update private.callio_sync_lease set lease=p_lease,expires=now()+interval '4 minutes' where id and (expires is null or expires<now());
 get diagnostics n=row_count;return n=1;
end $$;
create function public.release_callio_sync(p_lease uuid) returns void language sql security definer set search_path='' as $$
 update private.callio_sync_lease set expires=null,lease=null where id and lease=p_lease;
$$;
revoke all on function public.claim_callio_sync(uuid),public.release_callio_sync(uuid) from public,anon,authenticated;
grant execute on function public.claim_callio_sync(uuid),public.release_callio_sync(uuid) to service_role;
commit;
