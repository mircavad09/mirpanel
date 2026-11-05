begin;
create table if not exists public.manual_bot_rules(
 id uuid primary key, product text, question text not null, explanation text not null, answer text not null default '', updated_at timestamptz not null default now()
);
create index if not exists manual_bot_rules_product on public.manual_bot_rules(product);
create table if not exists public.manual_bot_unanswered(
 id uuid primary key, product text, question text not null, created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.manual_bot_rules enable row level security;
alter table public.manual_bot_unanswered enable row level security;
revoke all on public.manual_bot_rules,public.manual_bot_unanswered from public,anon,authenticated;
grant all on public.manual_bot_rules,public.manual_bot_unanswered to service_role;
create or replace function public.manual_stock_bot(p_action text,p_employee uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare pid text:=nullif(p_data->>'product',''); uid uuid:=(p_data->>'id')::uuid; result jsonb; all_access boolean;
begin
 if not coalesce((select enabled from manual_stock_release where id),false) then raise exception 'FORBIDDEN';end if;
 if p_employee is not null then
  select manual_all_products into all_access from employee_accounts where id=p_employee and active and archived_at is null;
  if not found or p_action not in ('knowledge','unanswered','reference') then raise exception 'FORBIDDEN';end if;
  if pid is not null and not all_access and not exists(select 1 from manual_stock_products p join manual_stock_permissions m on m.product_id=p.id where p.active and p.source_product_id=pid and m.employee_id=p_employee) then raise exception 'FORBIDDEN';end if;
 end if;
 if p_action='knowledge' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select id,product,question,explanation,answer,'rule' kind from manual_bot_rules where product is null or product=pid
   union all select id,source_product_id,title,explanation,answer,'problem' from manual_stock_problems where source_product_id=pid
   limit 150
  )x;return result;
 elsif p_action='reference' and p_employee is not null then
  select jsonb_build_object('id',id,'title',title,'explanation',explanation,'answer',answer) into result from manual_stock_problems where source_product_id=pid and id=uid;
  return result;
 elsif p_action='unanswered' and p_employee is not null then
  insert into manual_bot_unanswered(id,product,question) values(uid,pid,p_data->>'question') on conflict(id) do nothing;
 elsif p_action='admin' and p_employee is null then
  return jsonb_build_object('rules',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from manual_bot_rules order by updated_at desc,id limit 250)x),
   'unanswered',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,product,question,created_at from manual_bot_unanswered where resolved_at is null order by created_at desc,id limit 100)x));
 elsif p_action='save' and p_employee is null then
  insert into manual_bot_rules(id,product,question,explanation,answer) values(uid,pid,p_data->>'question',p_data->>'explanation',coalesce(p_data->>'answer',''))
   on conflict(id) do update set product=excluded.product,question=excluded.question,explanation=excluded.explanation,answer=excluded.answer,updated_at=now();
  if p_data->>'unansweredId' is not null then update manual_bot_unanswered set resolved_at=coalesce(resolved_at,now()) where id=(p_data->>'unansweredId')::uuid;end if;
 elsif p_action='delete' and p_employee is null then
  delete from manual_bot_rules where id=uid;
 else raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('ok',true);
end$$;
revoke all on function public.manual_stock_bot(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manual_stock_bot(text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
