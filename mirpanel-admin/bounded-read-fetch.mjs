// RPC reads use POST too. Never replay a write or fabricate an empty result.
const readRpcs=new Set(['inventory_snapshot','inventory_schema_ready','product_sales_snapshot','employee_system_ready']);
export async function boundedReadFetch(input, init = {}, {timeoutMs=15000,send=fetch}={}) {
  const method = String(init.method || input?.method || "GET").toUpperCase();
  const url = String(input?.url || input);
  const path=new URL(url).pathname,rpc=path.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  const bounded = ["GET", "HEAD"].includes(method) || method==='POST'&&(readRpcs.has(rpc)||rpc==='consume_payment_rate_limit'||/\/storage\/v1\/object\/sign\//.test(path));
  if (!bounded) return send(input, init);
  const controller=new AbortController(),parent=init.signal||input?.signal;
  const abort=()=>controller.abort(parent.reason||new DOMException('Request cancelled','AbortError'));
  if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{controller.abort(new DOMException('Upstream read timed out','TimeoutError'));parent?.removeEventListener('abort',abort);},timeoutMs);
  timer.unref?.();
  // Keep the deadline active through response-body consumption by Supabase.
  try{return await send(input,{...init,signal:controller.signal});}
  catch(error){clearTimeout(timer);parent?.removeEventListener('abort',abort);throw error;}
}
