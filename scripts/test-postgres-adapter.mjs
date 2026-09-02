import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
import fs from 'node:fs';
import crypto from 'node:crypto';

export async function createTestDatabase() {
  const password=process.env.MIRPANEL_TEST_DB_PASSWORD;
  delete process.env.MIRPANEL_TEST_DB_PASSWORD;
  if(!password) throw new Error('TEST_PASSWORD_MISSING');
  const schema=`queue_test_${crypto.randomBytes(8).toString('hex')}`;
  const storage=`${schema}_storage`;
  const client=postgres({host:'aws-1-eu-west-1.pooler.supabase.com',port:5432,
    username:'postgres.edbqjvggvkxbrwyrdbsd',database:'postgres',password,
    ssl:{rejectUnauthorized:true,ca:fs.readFileSync(new URL('../payment-test-artifacts/postgres-driver/supabase-ca.crt',import.meta.url))},
    max:12,prepare:false,connect_timeout:15,idle_timeout:10,onnotice:()=>{},
    connection:{application_name:'mirpanel-synthetic-queue-test',statement_timeout:30000,options:`-c search_path=${schema},public`}});
  await client.unsafe(`create schema ${schema}; grant usage on schema ${schema} to service_role;`);
  const rewrite=s=>s.replace(/create role anon; create role authenticated; create role service_role bypassrls;/g,'')
    .replace(/create extension if not exists pgcrypto;/g,'')
    .replace(/\bpublic\./g,`${schema}.`).replace(/\bstorage\./g,`${storage}.`)
    .replace(/create schema storage/g,`create schema ${storage}`)
    .replace(/schema public\b/g,`schema ${schema}`)
    .replace(/search_path\s*=\s*public\b/gi,`search_path=${schema}`)
    .replace(/nspname\s*=\s*'public'/g,`nspname='${schema}'`)
    .replace(/schemaname\s*=\s*'public'/g,`schemaname='${schema}'`)
    .replace(/mirpanel_queue_backup_20260902/g,`${schema}_backup`);
  const db={
    real:true,schema,
    query:async(s,p=[])=>({rows:Array.from(await client.unsafe(rewrite(s),p))}),
    exec:async s=>{const c=await client.reserve();try{await c.unsafe(rewrite(s)).simple();}catch(e){await c.unsafe('rollback');throw e;}finally{c.release();}},
    close:async()=>client.end({timeout:5}),
    connectionProof:async()=>{
      const rows=await Promise.all(Array.from({length:12},()=>client.begin(async tx=>{
        const [r]=await tx`select pg_backend_pid() as pid`;await tx`select pg_sleep(0.5)`;return r.pid;
      })));
      return new Set(rows).size;
    }
  };
  return db;
}
