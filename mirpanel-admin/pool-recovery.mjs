// pg removes an errored idle client itself. Handle the pool event so a database
// restart does not become an unhandled EventEmitter error and kill HTTP service.
// Do not retry a query/transaction here: its outcome may be uncertain.
const installed=new WeakSet();
export function guardPoolErrors(pool,label,log=console.warn){
 if(installed.has(pool))return pool;installed.add(pool);
 pool.on('error',error=>{const code=/^[A-Z0-9_]{1,32}$/.test(error?.code||'')?error.code:'CONNECTION_LOST';log(label+'_IDLE_CONNECTION_LOST',code);});
 return pool;
}
