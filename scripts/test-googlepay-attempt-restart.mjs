import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {readEpointPayment} from '../mirpanel-admin/epoint-checkout.mjs';
let input='';for await(const part of process.stdin)input+=part;
const data=JSON.parse(input);if(data.connection.host!=='127.0.0.1')throw Error('Loopback only');
const pool=new pg.Pool({...data.connection,options:'-c search_path=mirpanel_community,public'});
try{for(const ref of data.ids){const s=await readEpointPayment(pool,'a',ref);if(s.status!=='success')throw Error('Persisted success missing');}
console.log(JSON.stringify({credits:(await pool.query("select count(*)::int n from wallet_ledger where kind='topup_credit'")).rows[0].n}));}finally{await pool.end();}
