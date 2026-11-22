import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const fixture=`<meta name="viewport" content="width=device-width"><div id="host"></div><script type="module">
import {mountReadyStock} from '/ready-stock-admin.js';
window.commands=[];let linked=false;
const row=()=>({id:'synthetic-unit',productId:'synthetic',planKey:'0',planSignature:linked?'new':'old',productName:'Sintetik HBO',planName:'1 ay',status:'ready',revision:0,email:'synthetic@example.test',editable:true,assigned:false,packageAvailable:linked,planIndex:linked?0:null});
mountReadyStock(document.querySelector('#host'),async(url,options)=>{
 if(options?.method==='POST'){
  const command=JSON.parse(options.body).accountManage;window.commands.push(command);
  if(command.action==='open')return {email:'synthetic@example.test',password:'Synthetic-only',message:'  original\\r\\ntext  ',revision:0,reserved:false,packageAvailable:linked,planIndex:linked?0:null,planName:'1 ay'};
  if(command.action==='relink'){linked=true;return {saved:true};}
  throw Error('Unexpected mutation');
 }
 return {accounts:[row()],products:[{id:'synthetic',title:'Sintetik HBO',readyTotal:linked?1:0,unmatchedReady:linked?0:1,plans:[{index:0,title:'1 ay',signature:'new',ready:linked?1:0,sales:15,autoWallet:true}]}]};
});</script>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(fixture);}
 const file='mirpanel-admin/public'+url.pathname;
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByText('İdarə et',{exact:true}).click();
  await page.getByRole('button',{name:'Redaktə et',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByRole('combobox',{name:'Paket',exact:true}).selectOption('0');
  await dialog.getByRole('button',{name:'Dəyişikliyi saxla',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  const commands=await page.evaluate(()=>window.commands);
  assert.deepEqual(commands.map(c=>c.action),['open','relink']);
  assert.deepEqual(commands[1],{action:'relink',id:'synthetic-unit',revision:0,index:0,planSignature:'new',fromSignature:'old'});
  assert.equal(await page.locator('[data-ready]').innerText(),'1');
  console.log(JSON.stringify({engine:engine.name(),width,scopeOnlyCommand:true,noCredentialsResubmitted:true,countRefreshed:true,syntheticOnly:true}));
  await page.close();
 }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
