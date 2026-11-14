import fs from 'node:fs/promises';
export async function ensureDeliverySales(pool){
 const {rows:[state]}=await pool.query("select to_regclass('public.product_sales_delivery_release') installed,to_regprocedure('public.product_sales_snapshot()') supported");
 if(!state.installed&&state.supported)await pool.query(await fs.readFile(new URL('./product-sales-delivery.sql',import.meta.url),'utf8'));
}
