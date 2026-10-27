// Install pinned local OCR runtime for the existing Render service; no DB connection.
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../receipt-worker/',import.meta.url));
for(const [cmd,args] of [[process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev','--no-audit','--no-fund']],[process.execPath,[fileURLToPath(new URL('./check-receipt-runtime.mjs',import.meta.url))]],[process.execPath,['models.mjs']]]){const r=spawnSync(cmd,args,{cwd:dir,stdio:'inherit',shell:process.platform==='win32'&&cmd==='npm.cmd'});if(r.status!==0)process.exit(r.status||1);}
