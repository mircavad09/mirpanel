import postgres from '../payment-test-artifacts/postgres-driver/package/src/index.js';
import fs from 'node:fs';

// Fixed non-production destination. Never accept a connection URL or log errors verbatim.
const password = process.env.MIRPANEL_TEST_DB_PASSWORD;
delete process.env.MIRPANEL_TEST_DB_PASSWORD;
if (!password) throw new Error('TEST_PASSWORD_MISSING');
const sql = postgres({
  host: 'aws-1-eu-west-1.pooler.supabase.com', port: 5432,
  username: 'postgres.edbqjvggvkxbrwyrdbsd', database: 'postgres', password,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(new URL('../payment-test-artifacts/postgres-driver/supabase-ca.crt', import.meta.url)) }, max: 3, connect_timeout: 15,
  idle_timeout: 5, prepare: false,
  connection: { application_name: 'mirpanel-test-readonly-check', statement_timeout: 10000 },
  onnotice: () => {},
});
try {
  const results = await Promise.all(Array.from({length: 3}, () => sql.begin('read only', async tx => {
    const [row] = await tx`select pg_backend_pid() as pid, current_database() as db`;
    await tx`select pg_sleep(1)`;
    return row;
  })));
  const distinct = new Set(results.map(r => r.pid)).size;
  console.log(JSON.stringify({ authenticated: true, independentConnections: distinct, readOnly: true }));
  if (distinct !== 3) process.exitCode = 1;
} catch (error) {
  const code = String(error.code || 'CONNECTION_FAILED');
  console.log(JSON.stringify({ authenticated: false, errorCode: /^[A-Z0-9_]+$/.test(code) ? code : 'CONNECTION_FAILED' }));
  process.exitCode = 1;
} finally { await sql.end({timeout: 5}); }
