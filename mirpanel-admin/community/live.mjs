import {randomUUID} from 'node:crypto';

// One database listener per application, never one polling query per viewer.
export class CommunityLive {
 constructor(pool,repo,counts){this.pool=pool;this.repo=repo;this.counts=counts;this.clients=new Set();this.serial=Promise.resolve();this.closed=false;}
 async start(){
  if(this.listener)return;
  if(this.starting)return this.starting;
  this.starting=(async()=>{const c=await this.pool.connect();try{await c.query('LISTEN mirpanel_community_live');}catch(e){c.release(true);throw e;}this.listener=c;
   c.on('notification',n=>{let event;try{event=JSON.parse(n.payload);}catch{}if(event?.kind==='moderation'){this.serial=this.serial.then(async()=>{await this.heartbeat();for(const x of this.clients){if(['hide','delete'].includes(event.action))this.write(x,'messages',{items:[],removed:[event.targetId]});this.write(x,'settings',{});}});}this.schedule();});
   c.on('error',()=>{if(this.listener!==c)return;this.listener=null;c.release(true);for(const x of this.clients)x.res.end();});
   if(!this.timer){this.timer=setInterval(()=>this.heartbeat().catch(()=>{for(const x of this.clients)x.res.end();}),20000);this.timer.unref();}
  })().finally(()=>{this.starting=null;});return this.starting;
 }
 write(x,type,value){if(x.res.destroyed)return;const ok=x.res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);if(!ok&&x.res.writableLength>262144)x.res.destroy();}
 schedule(){this.serial=this.serial.then(()=>this.broadcast()).catch(()=>{for(const x of this.clients)x.res.end();});return this.serial;}
 async broadcast(){
  if(!this.clients.size)return;
  // Share hydration across tabs with the same cursor and visible IDs.
  const batches=new Map(),viewers=[...this.clients],countPromise=this.counts(this.pool);
  for(const x of viewers){const key=x.after+'|'+[...x.known].join(',');if(!batches.has(key))batches.set(key,this.repo.messages({after:x.after||null,known:[...x.known].join(',')}));}
  for(const x of viewers){const key=x.after+'|'+[...x.known].join(',');const r=await batches.get(key);if(this.clients.has(x))this.deliver(x,r);}
  const count=await countPromise;for(const x of this.clients)this.write(x,'counts',count);
 }
 deliver(x,r){for(const id of r.removed||[])x.known.delete(id);for(const m of r.items){x.known.add(m.id);x.after=Math.max(x.after,Number(m.id));}while(x.known.size>500)x.known.delete(x.known.values().next().value);this.write(x,'messages',r);if(r.more)this.schedule();}
 async attach(req,res,session,u){
  if(this.closed||this.clients.size>=200)throw Object.assign(Error('Canlı bağlantı hazırda məşğuldur.'),{status:503});
  const raw=u.searchParams.get('after')||'0',known=u.searchParams.get('known')||'';
  if(!/^\d{1,19}$/.test(raw)||!Number.isSafeInteger(Number(raw))||known.length>10000||known&&!/^\d{1,19}(,\d{1,19}){0,499}$/.test(known)||known.split(',').some(id=>id&&BigInt(id)>9223372036854775807n))throw Object.assign(Error('Sorğu düzgün deyil.'),{status:400});
  await this.start();
  const x={res,after:Number(raw),known:new Set(known?known.split(','):[]),user:session?.user?.id,sid:session?.session?.id,tab:randomUUID()};
  if(x.user)await this.pool.query('insert into community_presence(user_id,session_id,tab_id) values($1,$2,$3)',[x.user,x.sid,x.tab]);
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'private,no-store,no-transform','X-Accel-Buffering':'no','Vary':'Cookie, Origin','X-Content-Type-Options':'nosniff'});res.flushHeaders?.();res.write(': connected\n\n');this.clients.add(x);
  res.once('close',()=>{this.clients.delete(x);if(x.user)this.pool.query('delete from community_presence where session_id=$1 and tab_id=$2',[x.sid,x.tab]).then(()=>this.pool.query("select pg_notify('mirpanel_community_live','{}')")).catch(()=>{});});
  // Guest connects do not change presence. Do not rehydrate every viewer on each join.
  // Keep delivery on the same serial chain as notifications so snapshots cannot race.
  this.serial=this.serial.then(async()=>{
   if(!this.clients.has(x))return;
   const [snapshot,count]=await Promise.all([this.repo.messages({after:x.after||null,known:[...x.known].join(',')}),this.counts(this.pool)]);
   if(!this.clients.has(x))return;this.deliver(x,snapshot);this.write(x,'counts',count);
   if(x.user)await this.pool.query("select pg_notify('mirpanel_community_live','{}')");
  }).catch(()=>res.destroy());await this.serial;
 }
 async heartbeat(){
  if(!this.clients.size)return;
  if(!(await this.pool.query('select ready from public_community_release where version=1')).rows[0]?.ready){for(const x of this.clients)x.res.end();return;}
  const signed=[...this.clients].filter(x=>x.user);
  if(signed.length){const valid=new Set((await this.pool.query(`select s.id from session s left join community_profiles p on p.user_id=s."userId" where s.id=any($1::text[]) and s."expiresAt">clock_timestamp() and (p.blocked is distinct from true or p.ban_until<=clock_timestamp())`,[signed.map(x=>x.sid)])).rows.map(x=>x.id));for(const x of signed)if(!valid.has(x.sid))x.res.end();
   await this.pool.query('update community_presence set last_seen=clock_timestamp() where tab_id=any($1::uuid[])',[signed.filter(x=>valid.has(x.sid)).map(x=>x.tab)]);
  }
  const count=await this.counts(this.pool);for(const x of this.clients){x.res.write(': heartbeat\n\n');this.write(x,'counts',count);}
 }
 async close(){this.closed=true;clearInterval(this.timer);for(const x of this.clients)x.res.end();if(this.listener){const c=this.listener;this.listener=null;await c.query('UNLISTEN mirpanel_community_live');c.release();}}
}
