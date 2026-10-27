import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import{execFileSync}from'node:child_process';
import{createAdminSessions,ADMIN_IDLE_MS}from'../mirpanel-admin/admin-sessions.mjs';
import{localEmployeeDatabase}from'./employee-local-postgres.mjs';
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
if(process.argv.includes('--before')){
 const source=execFileSync('git',['show','1d18654:mirpanel-admin/server.mjs'],{encoding:'utf8'});
 const load=()=>{const c=vm.createContext({Date});vm.runInContext('const sessions=new Map();const sessionTtl=8*3600000;'+source.slice(source.indexOf('function getCookies('),source.indexOf('function sessionCookie('))+';globalThis.store=sessions;globalThis.read=getSession;',c);return c;};
 const id='a'.repeat(64),first=load();first.store.set(id,{expiresAt:Date.now()+3600000});eq(!!first.read({headers:{cookie:'mirpanel_session='+id}}),true);
 const restarted=load();eq(!!restarted.read({headers:{cookie:'mirpanel_session='+id}}),true,'REGRESSION: active admin session must survive server restart');
 process.exit(0);
}
let clock=1000000;const mem=createAdminSessions({username:'synthetic',password:'synthetic',now:()=>clock});const a=await mem.create();eq(a.session.expiresAt,clock+3600000);clock+=59*60000;eq(!!await mem.read(a.id),true);eq((await mem.read(a.id)).expiresAt,a.session.expiresAt,'poll/read does not touch');await mem.touch(a.id);clock+=59*60000;eq(!!await mem.read(a.id),true);clock+=60000;eq(await mem.read(a.id),null,'exact 60 minute idle boundary');eq(await mem.touch(a.id),null,'expired session cannot revive');eq(ADMIN_IDLE_MS,3600000);
const db=await localEmployeeDatabase();
try{
 await db.exec('create table legacy_fixture(id int primary key,data text);insert into legacy_fixture values(1,\'synthetic untouched\')');
 const migration=fs.readFileSync('supabase/migrations/202610270003_admin_sessions.sql','utf8'),verify=fs.readFileSync('supabase/admin-sessions-verify.sql','utf8');
 await db.exec(migration);await db.exec(migration);await db.exec(verify);eq((await db.sql`select count(*)::int n from admin_sessions_release_20261027.manifest`)[0].n,1);
 const client={rpc:async(_,p)=>{try{return{data:(await db.sql`select public.admin_session_action(${p.p_action},${p.p_hash},${p.p_binding}) as data`)[0].data};}catch{return{error:true};}}};
 const config={client,username:'synthetic',password:'synthetic',secret:'synthetic-stable-auth-key'};
 const s1=createAdminSessions(config),created=await s1.create(),s2=createAdminSessions(config);
 eq(!!await s2.read(created.id),true,'separate application instance survives restart');eq((await s2.read(created.id)).csrfToken,created.session.csrfToken,'stable CSRF after restart');
 const row=(await db.sql`select * from admin_sessions`)[0];eq(row.token_hash===created.id,false,'no raw bearer stored');eq(JSON.stringify(row).includes(created.session.csrfToken),false,'no raw csrf stored');
 const previous=row.expires_at;await s2.read(created.id);eq((await db.sql`select expires_at from admin_sessions`)[0].expires_at.toISOString(),previous.toISOString(),'background polling cannot renew DB expiry');
 await db.sql`update admin_sessions set last_activity_at=now()-interval '59 minutes',expires_at=now()+interval '1 minute'`;
 const active=await s2.touch(created.id);eq(active.expiresAt>Date.now()+59*60000,true,'real action renews to 60 minutes');
 await db.sql`update admin_sessions set expires_at=now()-interval '1 second'`;
 eq(await s2.read(created.id),null);eq(await s2.touch(created.id),null);
 const b=await s1.create();await s2.revoke(b.id);eq(await s1.read(b.id),null,'logout immediate across instances');eq(await createAdminSessions(config).read(b.id),null,'logout remains revoked after restart');
 const c=await s1.create();eq(await createAdminSessions({...config,password:'changed-synthetic'}).read(c.id),null,'password rotation invalidates');
 const broken=createAdminSessions({...config,client:{rpc:async()=>({error:true})}});await assert.rejects(()=>broken.read(c.id),e=>e.status===503);checks++;
 eq((await db.sql`select data from legacy_fixture`)[0].data,'synthetic untouched');
 await db.exec(fs.readFileSync('supabase/rollback/202610270003_admin_sessions.sql','utf8'));eq((await db.sql`select count(*)::int n from admin_sessions`)[0].n>0,true,'rollback keeps records');eq((await db.sql`select has_function_privilege('service_role','public.admin_session_action(text,text,text)','EXECUTE') ok`)[0].ok,false);
 await db.exec(migration);await db.exec(verify);eq((await db.sql`select data from legacy_fixture`)[0].data,'synthetic untouched');
 console.log(JSON.stringify({ok:true,checks,failures:0,realPostgreSQL:true,migrationFirstRepeatRollback:true,productionWrites:0}));
}finally{await db.close();}
