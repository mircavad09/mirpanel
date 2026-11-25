// A transient startup/database error must not leave mail polling off for the
// entire process lifetime. Existing worker start methods are idempotent.
export async function startMailWorkers(start,{attempts=6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),report=(...args)=>console.info(...args)}={}){
 for(let attempt=1;attempt<=attempts;attempt++){
  try{await start();report('COMMUNITY_MAIL_WORKERS_READY');return;}
  catch(error){
   const code=String(error?.code||error?.name||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'').slice(0,60);
   report('COMMUNITY_MAIL_WORKERS_START_RETRY',attempt,code);
   if(attempt===attempts)throw error;
   await wait(Math.min(60000,2000*2**(attempt-1)));
  }
 }
}
