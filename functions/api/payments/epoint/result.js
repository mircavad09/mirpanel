// Server-to-server endpoint: no customer cookies, no browser origin requirement.
const endpoint='https://mirpanel-frankfurt.onrender.com/api/payments/epoint/result';
const safeHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function onRequest({request}){
 if(request.method!=='POST')return Response.json({error:'POST tələb olunur.'},{status:405,headers:{...safeHeaders,Allow:'POST'}});
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':request.headers.get('Content-Type')||'application/octet-stream'},body:request.body,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.headers.get('Content-Type')?.startsWith('application/json'))throw Error('Invalid upstream response');
  const headers={...safeHeaders,'Content-Type':'application/json; charset=utf-8'};
  if(r.headers.has('Retry-After'))headers['Retry-After']=r.headers.get('Retry-After');
  return new Response(r.body,{status:r.status,headers});
 }catch{return Response.json({error:'Epoint nəticəsi hazırda emal olunmur.'},{status:503,headers:{...safeHeaders,'Retry-After':'60'}});}
}
