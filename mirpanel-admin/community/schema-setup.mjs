import {createHash} from 'node:crypto';
// Version each exact schema body; one dedicated connection owns its transaction.
// Never return an aborted BEGIN to a pool. No immediate retry after a lock error.
const states=new WeakMap();
export function ensureSchema(pool,name,source,{seed,now=Date.now,cooldownMs=30000}={}){
 const sql=source.replace(/^\s*begin\s*;/i,'').replace(/commit\s*;\s*$/i,'');
 const version=createHash('sha256').update(source).digest('hex'),key=name+':'+version;
 let entries=states.get(pool);if(!entries){entries=new Map();states.set(pool,entries);}const old=entries.get(key);
 if(old?.promise)return old.promise;if(old?.retryAt>now())return Promise.reject(old.error);
 const entry={};entries.set(key,entry);
 entry.promise=(async()=>{const c=await pool.connect();let failed;
  try{await c.query('begin');await c.query("set local lock_timeout='1500ms';set local statement_timeout='12s';set local idle_in_transaction_session_timeout='15s'");
   // One bounded setup lock across processes, separate from financial locks.
   await c.query('select pg_advisory_xact_lock(92700991)');
   const installed=await c.query("select to_regclass('mirpanel_community.runtime_schema_versions') is not null as installed");
   if(!installed.rows[0].installed)await c.query('create table mirpanel_community.runtime_schema_versions(name text primary key,version text not null,applied_at timestamptz not null default clock_timestamp());alter table mirpanel_community.runtime_schema_versions enable row level security;revoke all on mirpanel_community.runtime_schema_versions from public,anon,authenticated');
   const row=(await c.query('select version from mirpanel_community.runtime_schema_versions where name=$1',[name])).rows[0];
   if(row?.version!==version){await c.query(sql);if(seed)await seed(c);await c.query('insert into mirpanel_community.runtime_schema_versions(name,version) values($1,$2) on conflict(name) do update set version=excluded.version,applied_at=clock_timestamp()',[name,version]);}
   await c.query('commit');
  }catch(error){try{await c.query('rollback');}catch(rollbackError){failed=rollbackError;}throw error;}finally{c.release(failed);}
 })().catch(error=>{entry.error=error;entry.retryAt=now()+cooldownMs;entry.promise=null;throw error;});return entry.promise;
}
