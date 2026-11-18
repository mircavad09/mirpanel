// Server-to-server endpoint: no customer cookies, no browser origin requirement.
const endpoint='https://mirpanel-frankfurt.onrender.com/api/payments/epoint/result';
const safeHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const maxBody=65536;
async function readPacket(request){
 if(Number(request.headers.get('Content-Length'))>maxBody)return null;
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader(),packet=new Uint8Array(maxBody);
 let used=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)return packet.subarray(0,used);
   if(used+value.byteLength>maxBody){void reader.cancel().catch(()=>{});return null;}
   packet.set(value,used);used+=value.byteLength;
  }
 }finally{reader.releaseLock();}
}
export async function onRequest({request}){
 if(request.method!=='POST')return Response.json({error:'POST tələb olunur.'},{status:405,headers:{...safeHeaders,Allow:'POST'}});
 const unavailable=stage=>Response.json({error:'Epoint nəticəsi hazırda emal olunmur.'},{status:503,headers:{...safeHeaders,'Retry-After':'60','Server-Timing':'epoint-proxy;desc="'+stage+'"'}});
 let phase='read';
 try{
  // Forward the exact signed bytes as a known-length payload, rather than
  // passing the incoming stream through the edge runtime to a second origin.
  const body=await readPacket(request);
  if(body===null)return Response.json({error:'Bildiriş həddən artıq böyükdür.'},{status:413,headers:safeHeaders});
  phase='transport';
  const r=await fetch(new URL(endpoint),{method:'POST',headers:{'Content-Type':request.headers.get('Content-Type')||'application/octet-stream',Accept:'application/json',Origin:new URL(request.url).origin},body,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(!r.headers.get('Content-Type')?.startsWith('application/json')||r.status>=300&&r.status<400)return unavailable('upstream-'+r.status);
  phase='response';
  const headers={...safeHeaders,'Content-Type':'application/json; charset=utf-8'};
  if(r.headers.has('Retry-After'))headers['Retry-After']=r.headers.get('Retry-After');
  return new Response(await r.text(),{status:r.status,headers});
 }catch{return unavailable(phase);}
}
