import fs from 'node:fs/promises';
export async function ensureDeliverySales(pool){
 const {rows:[state]}=await pool.query("select to_regclass('public.product_sales_delivery_release') installed,to_regprocedure('public.product_sales_snapshot()') supported");
 if(!state.installed&&state.supported)await pool.query(await fs.readFile(new URL('./product-sales-delivery.sql',import.meta.url),'utf8'));
 if(state.supported&&!(await pool.query("select to_regclass('public.product_sales_baseline_release') installed")).rows[0].installed)
  await pool.query(await fs.readFile(new URL('./product-sales-baselines.sql',import.meta.url),'utf8'));
 if(state.supported&&!(await pool.query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='product_sales_paid_release' and column_name='excess_guard') installed")).rows[0].installed)
  await pool.query(await fs.readFile(new URL('./product-sales-paid.sql',import.meta.url),'utf8'));
}
