begin;
alter table public.employee_accounts add column if not exists archived_at timestamptz;
do $$begin
 if not exists(select 1 from pg_constraint where conname='employee_archived_inactive' and conrelid='public.employee_accounts'::regclass) then
  alter table public.employee_accounts add constraint employee_archived_inactive check(archived_at is null or not active);
 end if;
end$$;
create or replace function public.manual_stock_archive_employee(p_id uuid,p_actor text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(p_actor like 'owner:%',false) then raise exception 'FORBIDDEN';end if;
 perform 1 from employee_accounts where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 update employee_accounts set active=false,session_version=session_version+1,archived_at=clock_timestamp() where id=p_id and archived_at is null;
 if found then
  delete from manual_stock_permissions where employee_id=p_id;
  insert into manual_stock_audit(actor,action,entity_id) values(p_actor,'account.archived',p_id);
 end if;
 return true;
end$$;
revoke all on function public.manual_stock_archive_employee(uuid,text) from public,anon,authenticated;
grant execute on function public.manual_stock_archive_employee(uuid,text) to service_role;
create or replace function public.manual_stock_unarchived_permission() returns trigger language plpgsql set search_path=public as $$
begin
 perform 1 from employee_accounts where id=new.employee_id and archived_at is null for update;
 if not found then raise exception 'FORBIDDEN';end if;
 return new;
end$$;
drop trigger if exists manual_stock_unarchived_permission on public.manual_stock_permissions;
create trigger manual_stock_unarchived_permission before insert or update on public.manual_stock_permissions for each row execute function public.manual_stock_unarchived_permission();
notify pgrst,'reload schema';
commit;
