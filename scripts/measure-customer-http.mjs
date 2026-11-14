// Public, read-only HTTP diagnostics. No credentials or response bodies logged.
for(const path of ['https://mirpanel.com/','https://mirpanel.com/mehsul/capcut-pro','https://mirpanel.com/api/payments/inventory','https://mirpanel.com/api/community/state','https://mirpanel.onrender.com/api/community/state']){
 for(let run=1;run<=5;run++){
  const start=performance.now();
  try{const r=await fetch(path,{signal:AbortSignal.timeout(20000)}),ttfb=Math.round(performance.now()-start);const bytes=(await r.arrayBuffer()).byteLength;
   console.log(JSON.stringify({path,run,status:r.status,ttfbMs:ttfb,totalMs:Math.round(performance.now()-start),bytes,cache:r.headers.get('cf-cache-status'),age:r.headers.get('age'),serverTiming:r.headers.get('server-timing'),cacheControl:r.headers.get('cache-control')}));
  }catch(e){console.log(JSON.stringify({path,run,error:e.name,ms:Math.round(performance.now()-start)}));}
 }
}
