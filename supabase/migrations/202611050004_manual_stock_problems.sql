begin;
create table if not exists public.manual_stock_problems(
 id uuid primary key, source_product_id text not null, title text not null,
 explanation text not null, answer text not null, image_base64 text not null,
 created_at timestamptz not null default now(),
 check (length(image_base64) between 1 and 2796204)
);
create index if not exists manual_stock_problems_product on public.manual_stock_problems(source_product_id,created_at desc,id);
alter table public.manual_stock_problems enable row level security;
revoke all on public.manual_stock_problems from public,anon,authenticated;
grant all on public.manual_stock_problems to service_role;
create or replace function public.manual_stock_problem(p_action text,p_employee uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare product text:=p_data->>'product'; item uuid:=(p_data->>'id')::uuid; img text; result jsonb;
begin
 if not coalesce((select enabled from manual_stock_release where id),false) then raise exception 'FORBIDDEN';end if;
 if p_employee is not null then
  if p_action not in ('list','image') then raise exception 'FORBIDDEN';end if;
  select p.source_product_id into product from manual_stock_products p
   join manual_stock_permissions m on m.product_id=p.id
   join employee_accounts a on a.id=m.employee_id and a.active
   where p.id=(p_data->>'product')::uuid and p.active and a.id=p_employee;
  if product is null then raise exception 'FORBIDDEN';end if;
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into result from
   (select id,title,explanation,answer,created_at from manual_stock_problems where source_product_id=product order by created_at desc,id limit 26 offset coalesce((p_data->>'page')::int,0)*25)x;
  return result;
 elsif p_action='image' then
  select image_base64 into img from manual_stock_problems where id=item and source_product_id=product;
  if not found then raise exception 'NOT_FOUND';end if;
  return to_jsonb(img);
 elsif p_action='create' then
  insert into manual_stock_problems(id,source_product_id,title,explanation,answer,image_base64) values(item,product,p_data->>'title',p_data->>'explanation',p_data->>'answer',p_data->>'image') on conflict(id) do nothing;
 elsif p_action='update' then
  update manual_stock_problems set title=p_data->>'title',explanation=p_data->>'explanation',answer=p_data->>'answer',image_base64=coalesce(p_data->>'image',image_base64) where id=item and source_product_id=product;
  if not found then raise exception 'NOT_FOUND';end if;
 elsif p_action='delete' then
  delete from manual_stock_problems where id=item and source_product_id=product;
 else raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('ok',true,'id',item);
end$$;
revoke all on function public.manual_stock_problem(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manual_stock_problem(text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
