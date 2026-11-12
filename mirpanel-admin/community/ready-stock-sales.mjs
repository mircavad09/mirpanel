import fs from 'node:fs/promises';

export async function ensureReadyStockSales(pool){
 const {rows:[state]}=await pool.query("select to_regprocedure('public.ready_stock_set_sales(integer,text,uuid,integer,text)') installed,to_regprocedure('public.inventory_snapshot_before_netflix_rooms()') supported");
 if(!state.installed&&state.supported){
  await pool.query(await fs.readFile(new URL('./ready-stock-sales.sql',import.meta.url),'utf8'));
 }
}

export async function saveNetflixSales(pool,{available,requestId,expectedVersion,index=0},actor){
 try{
  return (await pool.query('select public.ready_stock_set_sales($1,$2,$3,$4,$5) result',[available,actor,requestId,expectedVersion,String(index)])).rows[0].result;
 }catch(error){
  if(/INVENTORY_VERSION_CONFLICT|IDEMPOTENCY_CONFLICT/.test(error.message)){
   throw Object.assign(Error('Stok dəyişib. Cari məlumatı yeniləyib təkrar yoxlayın.'),{status:409});
  }
  throw error;
 }
}
