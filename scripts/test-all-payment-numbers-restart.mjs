import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';import {ensureBalanceNumbers} from '../mirpanel-admin/balance-operation-numbers.mjs';
let data='';for await(const c of process.stdin)data+=c;const connection=JSON.parse(data);if(connection.host!=='127.0.0.1')throw Error('Loopback only');
const pool=new pg.Pool({...connection,options:'-c search_path=mirpanel_community,public'});try{await ensureBalanceNumbers(pool);console.log(JSON.stringify({maximum:(await pool.query('select max(number)::text n from balance_operation_numbers')).rows[0].n}));}finally{await pool.end();}
