begin;
create table if not exists public.manual_stock_instruction_images(
 unit_id uuid primary key references public.manual_stock_units(id),
 image_base64 text check(length(image_base64) between 1 and 2796204)
);
alter table public.manual_stock_instruction_images enable row level security;
revoke all on public.manual_stock_instruction_images from public,anon,authenticated;
grant all on public.manual_stock_instruction_images to service_role;
create or replace function public.manual_stock_intake_images(p_actor text,p_key uuid,p_data jsonb,p_images jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; img jsonb;
begin
 if not coalesce(p_actor like 'owner:%',false) then raise exception 'FORBIDDEN';end if;
 r:=manual_stock_intake(p_actor,p_key,p_data);
 for img in select value from jsonb_array_elements(p_images) loop
  if not exists(select 1 from jsonb_array_elements(p_data->'items') x where x->>'id'=img->>'id') then raise exception 'FORBIDDEN';end if;
  insert into manual_stock_instruction_images(unit_id,image_base64) values((img->>'id')::uuid,img->>'image') on conflict(unit_id) do nothing;
 end loop;
 return r;
end$$;
create or replace function public.manual_stock_instruction_image(p_action text,p_id uuid,p_employee uuid,p_image text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare target uuid:=p_id; img text;
begin
 if not coalesce((select enabled from manual_stock_release where id),false) then raise exception 'FORBIDDEN';end if;
 if p_employee is not null then
  if p_action not in ('read','exists') then raise exception 'FORBIDDEN';end if;
  select u.id into target from manual_stock_allocations a
   join manual_stock_units u on u.id=a.unit_id and u.allocation_id=a.id and u.state='TAKEN'
   join manual_stock_plans pl on pl.id=u.plan_id and pl.active
   join manual_stock_products pr on pr.id=pl.product_id and pr.active
   join manual_stock_permissions m on m.product_id=pr.id and m.employee_id=a.employee_id
   join employee_accounts e on e.id=a.employee_id and e.active
   where a.id=p_id and a.employee_id=p_employee and a.recalled_at is null;
  if target is null then if p_action='exists' then return 'false'::jsonb;end if;raise exception 'FORBIDDEN';end if;
 end if;
 if p_action='save' and p_employee is null then
  if not exists(select 1 from manual_stock_units where id=target) then raise exception 'NOT_FOUND';end if;
  insert into manual_stock_instruction_images(unit_id,image_base64) values(target,p_image) on conflict(unit_id) do update set image_base64=excluded.image_base64;
  return 'true'::jsonb;
 end if;
 select image_base64 into img from manual_stock_instruction_images where unit_id=target;
 if p_action='exists' then return to_jsonb(img is not null);end if;
 if p_action<>'read' or img is null then raise exception 'NOT_FOUND';end if;
 return to_jsonb(img);
end$$;
revoke all on function public.manual_stock_intake_images(text,uuid,jsonb,jsonb),public.manual_stock_instruction_image(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.manual_stock_intake_images(text,uuid,jsonb,jsonb),public.manual_stock_instruction_image(text,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
