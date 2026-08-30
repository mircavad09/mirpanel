// Isolated browser acceptance runner. No live payment endpoints or writes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { activeProductsWithSlugs, generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const future = structuredClone(state.products.find((p) => p.id === "capcut_pro") || state.products.find((p) => p.active && p.plans?.length));
Object.assign(future, { id: "resilience_future_test", _stableId: "resilience_future_test", title: "Gələcək test məhsulu", seoSlug: "resilience-future-test", active: true, soldOut: false, stockEnabled: false, flow: "direct" });
future.plans = [{ label: "Test planı", price: 1, months: 1 }];
const products = [...state.products, future];
const active = activeProductsWithSlugs(products).map(({ product, slug }) => ({ slug, plans: product.plans || [], unavailable: product.soldOut === true || product.flow === "out_of_stock" || (product.stockEnabled === true && product.stock !== null && product.stock !== "" && product.stock !== undefined && Number(product.stock) <= 0) }));
const pages = generateProductPageFiles(products, state.siteSections, state.cms, state.content);
const calls = new Map(); let writes = 0;
const method = { id: "isolated-test-card", providerName: "TEST BANK", last4: "0000", theme: "neutral", available: true };
const json = (res, data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
const runner = `<!doctype html><meta charset="utf-8"><title>Ödəniş dayanıqlılıq testləri</title><style>body{font:15px Arial;background:#111;color:#eee}iframe{height:844px;border:1px solid #888;max-width:100%}pre{white-space:pre-wrap}button{min-height:44px}</style><h1>İzolə edilmiş qəbul testi</h1><p>Canlı rezerv, sifariş və kart əməliyyatı edilmir.</p><button id="run">Bütün məhsul və planları yoxla</button><pre id="result">Hazırdır</pre><iframe id="frame" title="Test məhsulu" width="390"></iframe><script>
const products=${JSON.stringify(active)}; const frame=document.getElementById('frame'); const output=document.getElementById('result');
const wait=async(fn)=>{const end=Date.now()+12000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Test vaxt həddi');};
document.getElementById('run').onclick=async function(){this.disabled=true;const results=[];const errors=[];try{
for(const width of [320,390,768,1440]) {frame.width=width;
for(const p of products){
if(!p.plans.some(x=>Number(x.price)>0)&&!p.unavailable){results.push({slug:p.slug,width,status:'satış planı yoxdur'});continue;}
for(let plan=0;plan<Math.max(1,p.plans.length);plan++){
if(!p.unavailable && Number(p.plans[plan]?.price)<=0)continue;
output.textContent='Yoxlanılır: '+p.slug+' / '+plan+' / '+width+'px';
await new Promise(resolve=>{frame.onload=resolve;frame.src='/mehsul/'+p.slug+'?test='+Date.now();});
const w=frame.contentWindow,d=w.document;w.addEventListener('error',e=>errors.push(e.message));
await wait(()=>d.getElementById('pp-order-btn') && w.MirpanelPaymentFlow);
const order=d.getElementById('pp-order-btn');
if(p.unavailable){if(!order.disabled)throw Error(p.slug+': stok düyməsi aktivdir');results.push({slug:p.slug,width,status:'stokda yoxdur'});break;}
const plans=d.querySelectorAll('#pp-plans-container .pp-plan-label');if(plans[plan])plans[plan].click();
order.click();order.click();await wait(()=>d.getElementById('orderTermsAgreement'));
const consent=d.getElementById('orderTermsAgreement'),confirm=d.getElementById('orderConfirmationConfirm');
if(consent.checked||!confirm.disabled)throw Error('Checkbox ilkin vəziyyəti');
consent.click();confirm.click();
await wait(()=>d.getElementById('universalOrderForm')||d.querySelector('.paymentFlow'));
const form=d.getElementById('universalOrderForm');if(form){for(const control of form.querySelectorAll('input,textarea,select')){if(control.tagName==='SELECT'){control.value=[...control.options].find(x=>x.value)?.value||'';}else{const n=Number(control.dataset.codeLength)||0;control.value=n?'1'.repeat(n):control.type==='email'?'test@example.com':control.type==='number'?'1':'Test';}control.dispatchEvent(new w.Event('input',{bubbles:true}));control.dispatchEvent(new w.Event('change',{bubbles:true}));}form.querySelector('button[type="submit"]').click();}
await wait(()=>d.querySelector('.paymentMethodChoice'));
if(!d.querySelector('.paymentFlowHead p').textContent.includes(Number(p.plans[plan].price).toFixed(2)))throw Error('Seçilmiş plan məbləği uyğun deyil: '+p.slug+' '+plan);
if(d.querySelectorAll('.paymentFlow').length!==1)throw Error('Təkrar modal');
if(d.documentElement.scrollWidth>d.documentElement.clientWidth+1)throw Error('Daşma: '+p.slug+' '+width);
results.push({slug:p.slug,plan,width,status:'payment'});
}
}}
const stats=await fetch('/test-stats').then(r=>r.json());if(stats.writes)throw Error('Yazma sorğusu yaranıb');
output.textContent=JSON.stringify({ok:true,cases:results.length,products:products.length,widths:[320,390,768,1440],consoleErrors:errors,writes:stats.writes,results},null,2);
}catch(e){output.textContent=JSON.stringify({ok:false,error:e.message,finished:results.length,results},null,2);}finally{this.disabled=false;}};
</script>`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/runner'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(runner);return;}
 if(url.pathname==='/test-stats')return json(res,{writes,calls:Object.fromEntries(calls)});
 if(url.pathname.includes('/api/payments/')){
   if(req.method!=='GET'){writes++;return json(res,{error:'Test forbids mutations'},403);}
   const scenario=url.pathname.split('/')[2]||'ok';const count=(calls.get(scenario)||0)+1;calls.set(scenario,count);
   if(scenario==='html'&&count<=3){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>Service waking up</html>');return;}
   if(scenario==='slow'&&count===1){setTimeout(()=>json(res,{methods:[method],anyAvailable:true}),14000);return;}
   if(scenario==='error'&&count<=3)return json(res,{error:'test unavailable'},503);
   if(scenario==='empty')return json(res,{methods:[],anyAvailable:false});
   if(scenario==='limit')return json(res,{methods:[{...method,available:false}],anyAvailable:false});
   return json(res,{methods:[method],anyAvailable:true});
 }
 if(pages.has(url.pathname.slice(1)+'.page')){
   let html=pages.get(url.pathname.slice(1)+'.page');
   const scenario=['html','slow','error','empty','limit'].includes(url.searchParams.get('scenario'))?url.searchParams.get('scenario'):'ok';
   html=html.replace('</head>','<script>window.MIRPANEL_PAYMENT_API=location.origin+"/scenario/'+scenario+'";</script></head>');
   if(url.pathname.endsWith('/resilience-future-test'))html=html.replace(/(<script src="\/app\.js[^\"]*"><\/script>)/,'$1<script>DATA.products.push('+JSON.stringify(future).replace(/</g,'\\u003c')+');</script>');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
   const types={'.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));return;
 }
 res.writeHead(404);res.end();
}).listen(Number(process.argv[2] || 10128),'127.0.0.1',()=>console.log('Isolated service fixture ready'));
