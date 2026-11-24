// One immutable display sequence. Source IDs and all financial rows remain unchanged.
const S='mirpanel_community.',installed=new WeakMap(),signatures=new WeakMap();
export async function balanceNumberPlan(pool){
 const found=(await pool.query("select to_regclass('mirpanel_community.wallet_topups') manual,to_regclass('mirpanel_community.epoint_checkout_requests') checkout,to_regclass('mirpanel_community.epoint_wallet_intents') intents,to_regclass('mirpanel_community.topup_document_numbers') old,to_regclass('mirpanel_community.balance_operation_numbers') numbered")).rows[0];
 const parts=[];
 if(found.manual)parts.push(`select 'card-to-card'::text source,id operation_id,created_at,to_jsonb(t)->>'history_number' previous_number from ${S}wallet_topups t where status<>'draft'`);
 if(found.checkout)parts.push(`select 'epoint'::text source,id operation_id,created_at,null::text previous_number from ${S}epoint_checkout_requests q where coalesce(to_jsonb(q)->>'purpose','topup')='topup'`);
 if(found.intents)parts.push(`select 'epoint'::text source,id operation_id,created_at,null::text previous_number from ${S}epoint_wallet_intents i ${found.checkout?`where not exists(select 1 from ${S}epoint_checkout_requests q where q.id=i.id and to_jsonb(q)->>'purpose'='purchase')`:''}`);
 if(!parts.length)return [];
 return (await pool.query(`with operations as(${parts.join(' union all ')}), unique_operations as(select source,operation_id,min(created_at) created_at,max(previous_number) previous_number from operations group by source,operation_id)
 select o.source,o.operation_id,o.created_at,${found.old?"coalesce(o.previous_number,'MP-'||old.number::text)":'o.previous_number'} previous_number,(${found.numbered?`coalesce(bn.number,(select next_number-1 from ${S}balance_operation_counter where id)+sum(case when bn.number is null then 1 else 0 end) over(order by o.created_at,o.operation_id,o.source))`:'598+row_number() over(order by o.created_at,o.operation_id,o.source)'})::text proposed_number from unique_operations o ${found.old?`left join ${S}topup_document_numbers old on old.source=o.source and old.operation_id=o.operation_id`:''} ${found.numbered?`left join ${S}balance_operation_numbers bn on bn.source=o.source and bn.operation_id=o.operation_id`:''} order by o.created_at,o.operation_id,o.source`)).rows;
}
export async function ensureBalanceNumbers(pool){
 const signature=JSON.stringify((await pool.query("select to_regclass('mirpanel_community.wallet_topups') m,to_regclass('mirpanel_community.epoint_checkout_requests') q,to_regclass('mirpanel_community.epoint_wallet_intents') i")).rows[0]);
 if(signatures.get(pool)!==signature){installed.delete(pool);signatures.set(pool,signature);}
 if(!installed.has(pool)){const task=(async()=>{const c=await pool.connect();try{
  await c.query('begin');await c.query("set local lock_timeout='5s'");
  const exists=(await c.query("select to_regclass('mirpanel_community.wallet_topups') manual,to_regclass('mirpanel_community.epoint_checkout_requests') checkout,to_regclass('mirpanel_community.epoint_wallet_intents') intents")).rows[0];
  // Prevent an operation slipping between the initial snapshot and trigger installation.
  const tables=[exists.manual,exists.checkout,exists.intents].filter(Boolean);
  const backupTable=(await c.query("select to_regclass('mirpanel_community.balance_number_migration_backup') b")).rows[0].b;
  if(backupTable){const state=(await c.query(`select exists(select 1 from ${S}balance_number_migration_backup where id='unified-599-v1') saved,(select count(*)::int from pg_trigger where tgname='balance_number_insert' and tgenabled<>'D' and tgrelid=any($1::regclass[])) triggers`,[tables])).rows[0];if(state.saved&&state.triggers===tables.length){await c.query('commit');return;}}
  // Acquire table locks before the allocation lock: inserts take them in that
  // order too. Repeated startup checks above never block payment writes.
  if(tables.length)await c.query('lock table '+tables.join(',')+' in share row exclusive mode');
  await c.query('select pg_advisory_xact_lock(926112303)');
  await c.query(`create table if not exists ${S}balance_operation_numbers(source text not null check(source in ('epoint','card-to-card')),operation_id uuid not null,number bigint not null unique check(number>=599),primary key(source,operation_id));
   create table if not exists ${S}balance_operation_counter(id boolean primary key check(id),next_number bigint not null check(next_number>=599));
   create table if not exists ${S}balance_number_migration_backup(id text primary key,created_at timestamptz not null default clock_timestamp(),mapping jsonb not null,rollback_note text not null);
   insert into ${S}balance_operation_counter values(true,599) on conflict do nothing;
   alter table ${S}balance_operation_numbers enable row level security;alter table ${S}balance_operation_counter enable row level security;alter table ${S}balance_number_migration_backup enable row level security;
   revoke all on ${S}balance_operation_numbers,${S}balance_operation_counter,${S}balance_number_migration_backup from public,anon,authenticated;
   create or replace function ${S}assign_balance_number(p_source text,p_id uuid) returns bigint language plpgsql set search_path=pg_catalog,mirpanel_community as $$declare n bigint;begin
    perform pg_advisory_xact_lock(926112303);select number into n from mirpanel_community.balance_operation_numbers where source=p_source and operation_id=p_id;if found then return n;end if;
    update mirpanel_community.balance_operation_counter set next_number=next_number+1 where id returning next_number-1 into n;
    insert into mirpanel_community.balance_operation_numbers(source,operation_id,number) values(p_source,p_id,n);return n;end$$;
   revoke all on function ${S}assign_balance_number(text,uuid) from public,anon,authenticated;
   create or replace function ${S}balance_number_on_operation() returns trigger language plpgsql set search_path=pg_catalog,mirpanel_community as $$begin
    if TG_TABLE_NAME='wallet_topups' then if new.status<>'draft' then perform mirpanel_community.assign_balance_number('card-to-card',new.id);end if;
    elsif TG_TABLE_NAME='epoint_checkout_requests' then if coalesce(to_jsonb(new)->>'purpose','topup')='topup' then perform mirpanel_community.assign_balance_number('epoint',new.id);end if;
    else perform mirpanel_community.assign_balance_number('epoint',new.id);end if;return new;end$$;
   revoke all on function ${S}balance_number_on_operation() from public,anon,authenticated;`);
  const saved=(await c.query(`select 1 from ${S}balance_number_migration_backup where id='unified-599-v1'`)).rowCount;
  const plan=await balanceNumberPlan(c);
  if(!saved)await c.query(`insert into ${S}balance_number_migration_backup(id,mapping,rollback_note) values('unified-599-v1',$1,'Rollback presentation to the prior application version. Legacy wallet_topups.history_number and topup_document_numbers are unchanged. Keep the new mapping as an audit record; never modify the wallet ledger.')`,[JSON.stringify(plan)]);
  await c.query(`select ${S}assign_balance_number(v.row->>'source',(v.row->>'operation_id')::uuid) from jsonb_array_elements($1::jsonb) with ordinality as v(row,pos) order by pos`,[JSON.stringify(plan)]);
  for(const [table,present,event]of [['wallet_topups',exists.manual,'insert or update of status'],['epoint_checkout_requests',exists.checkout,'insert'],['epoint_wallet_intents',exists.intents,'insert']])if(present){await c.query(`drop trigger if exists balance_number_insert on ${S}${table};create trigger balance_number_insert after ${event} on ${S}${table} for each row execute function ${S}balance_number_on_operation()`);}
  await c.query('commit');
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}})();installed.set(pool,task);task.catch(()=>installed.delete(pool));}return installed.get(pool);
}
