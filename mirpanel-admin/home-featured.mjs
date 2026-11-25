// The existing bestSeller flag remains the sole editorial storefront setting.
export function createHomeFeatured({read,head,readAt,commit,extract,patch,patchHome,bump,listing=()=>new Map()}) {
 let cached,pending,writeQueue=Promise.resolve();
 async function snapshot(force=false){
  if(!force&&cached&&Date.now()-cached.at<15000)return cached.value;
  if(!force&&pending)return pending;
  const load=(async()=>{const file=await read();const data=extract(file.source);const value={version:file.sha,ids:[...new Set(data.products.filter(p=>p.bestSeller===true).sort((a,b)=>(Number(a.order)||99999)-(Number(b.order)||99999)).map(p=>p.id))]};cached={at:Date.now(),value};return value;})();
  pending=load;try{return await load;}finally{if(pending===load)pending=null;}
 }
 async function save(productId,selected){
  if(typeof productId!=='string'||typeof selected!=='boolean')throw Object.assign(Error('Məhsul və seçim düzgün deyil.'),{status:400});
  for(let attempt=0;attempt<3;attempt++){
   const parent=await head(),file=await readAt('app.js',parent.commitSha),data=extract(file.source),product=data.products.find(p=>p.id===productId);
   if(!product)throw Object.assign(Error('Məhsul tapılmadı.'),{status:404});
   if((product.bestSeller===true)===selected)return {productId,selected,version:file.sha};
   product.bestSeller=selected;
   const index=await readAt('index.html',parent.commitSha),version='featured-'+Date.now();
   const files=new Map([['app.js',patch(file.source,data)],['index.html',patchHome(bump(index.source,version),data.products,data.categories)],...listing(data.products,data.siteSections,data.cms,data.categories)]);
   try{const result=await commit({parent,files,removedPaths:[],message:'Update homepage featured selection: '+productId});cached=null;return {productId,selected,version:result.blobs.get('app.js'),commitSha:result.commitSha};}
   catch(e){if(e.code==='EDITOR_REF_MOVED'&&attempt<2)continue;throw e;}
  }
 }
 async function moveNow(productId,anchorId,after){
  if(typeof productId!=='string'||anchorId!==null&&typeof anchorId!=='string'||typeof after!=='boolean'||productId===anchorId)throw Object.assign(Error('Sıra seçimi düzgün deyil.'),{status:400});
  for(let attempt=0;attempt<3;attempt++){
   const parent=await head(),file=await readAt('app.js',parent.commitSha),data=extract(file.source),products=[...data.products].sort((a,b)=>(Number(a.order)||99999)-(Number(b.order)||99999));
   const product=products.find(p=>p.id===productId),anchor=products.find(p=>p.id===anchorId);if(!product||anchorId!==null&&!anchor)throw Object.assign(Error('Məhsul tapılmadı.'),{status:404});
   const ordered=products.filter(p=>p.id!==productId);ordered.splice(anchor?ordered.indexOf(anchor)+(after?1:0):ordered.length,0,product);ordered.forEach((p,i)=>p.order=i+1);data.products=ordered;
   const index=await readAt('index.html',parent.commitSha),files=new Map([['app.js',patch(file.source,data)],['index.html',patchHome(bump(index.source,'order-'+Date.now()),ordered,data.categories)],...listing(ordered,data.siteSections,data.cms,data.categories)]);
   try{const result=await commit({parent,files,removedPaths:[],message:'Update product position: '+productId});cached=null;return {orders:ordered.map(p=>({id:p.id,order:p.order})),commitSha:result.commitSha};}catch(e){if(e.code==='EDITOR_REF_MOVED'&&attempt<2)continue;throw e;}
  }
 }
 const queued=fn=>{const next=writeQueue.then(fn,fn);writeQueue=next.catch(()=>{});return next;};
 return {snapshot,save:(...args)=>queued(()=>save(...args)),move:(...args)=>queued(()=>moveNow(...args))};
}
