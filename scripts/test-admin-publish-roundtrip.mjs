import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import vm from "node:vm";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

// Real admin server and publisher, isolated Git and delivery origins. All outbound
// traffic from the child is refused except for this loopback fixture.
const hash = value => createHash("sha1").update(value).digest("hex");
const blob = data => hash(Buffer.concat([Buffer.from(`blob ${data.length}\0`), data]));
const blobs = new Map(), trees = new Map(), commits = new Map(), sessions = new Map();
const baseTree = new Map(["app.js", "index.html"].map(path => {
  const content = fs.readFileSync(path), sha = blob(content);
  blobs.set(sha, content);
  return [path, sha];
}));
let head = "a".repeat(40), live = head, writes = 0, loseRef = false, slow = false, abortRead = false;
trees.set("root", baseTree); commits.set(head, "root");
const json = (res, status, value) => { res.writeHead(status, {"content-type":"application/json"}); res.end(JSON.stringify(value)); };
const bytes = (ref, path) => blobs.get(trees.get(commits.get(ref))?.get(path));
const mock = http.createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  const u = new URL(req.url, "http://fixture"), route = u.pathname;
  if (route === "/rest/v1/rpc/admin_session_action") {
    const key = body.p_hash + ":" + body.p_binding;
    if (body.p_action === "create" || (body.p_action === "touch" && sessions.has(key))) sessions.set(key,{expiresAt:new Date(Date.now()+3600000).toISOString()});
    if (body.p_action === "revoke") sessions.delete(key);
    return json(res,200,sessions.get(key) || null);
  }
  if (route === "/rest/v1/rpc/consume_payment_rate_limit") return json(res,200,{allowed:true});
  if (route.startsWith("/rest/")) return json(res,200,[]);
  if (route.startsWith("/public")) {
    const file = route.slice(8) || "index.html", data = bytes(live,file);
    if (!data) return json(res,404,{});
    res.writeHead(200,{"content-type":file.endsWith(".js")?"application/javascript":"text/html"}); return res.end(data);
  }
  const git = route.replace(/^\/repos\/[^/]+\/[^/]+/,"");
  if (git.startsWith("/contents/")) {
    if (abortRead) { abortRead = false; return res.destroy(); }
    const ref=u.searchParams.get("ref"), path=decodeURIComponent(git.slice(10)), content=bytes(commits.has(ref)?ref:head,path);
    return content ? json(res,200,{sha:blob(content),content:content.toString("base64")}) : json(res,404,{});
  }
  if (git.startsWith("/git/ref/heads/")) return json(res,200,{object:{sha:head}});
  if (git.startsWith("/git/commits/")) return json(res,200,{tree:{sha:commits.get(git.split("/").at(-1))}});
  if (git === "/git/blobs") { const data=Buffer.from(body.content,body.encoding); const sha=blob(data);blobs.set(sha,data);return json(res,201,{sha}); }
  if (git === "/git/trees") {
    const tree=new Map(trees.get(body.base_tree)); for(const entry of body.tree) { if(entry.sha)tree.set(entry.path,entry.sha);else tree.delete(entry.path); }
    const sha=hash(JSON.stringify([...tree]));trees.set(sha,tree);return json(res,201,{sha});
  }
  if (git === "/git/commits") { const sha=hash(JSON.stringify(body));commits.set(sha,body.tree);return json(res,201,{sha}); }
  if (git.startsWith("/git/refs/heads/") && req.method==="PATCH") {
    assert.equal(body.force,false);
    if(slow)await new Promise(resolve=>setTimeout(resolve,350));
    head=body.sha;writes++;
    if(loseRef){loseRef=false;return res.destroy();}
    return json(res,200,{object:{sha:head}});
  }
  return json(res,404,{});
});
await new Promise(resolve=>mock.listen(0,"127.0.0.1",resolve));
const upstream="http://127.0.0.1:"+mock.address().port;
const port=10686, origin="http://127.0.0.1:"+port, username="synthetic-admin", password=randomBytes(24).toString("hex"), key=randomBytes(32).toString("base64");
const code=`const native=fetch;globalThis.fetch=(input,options)=>{const url=new URL(input?.url||input);if(url.origin===${JSON.stringify(upstream)})return native(input,options);if(url.origin==="https://api.github.com")return native(${JSON.stringify(upstream)}+url.pathname+url.search,options);if(url.origin==="https://mirpanel.com")return native(${JSON.stringify(upstream)}+"/public"+url.pathname+url.search,options);throw Error("Fixture blocks outbound requests");};await import(${JSON.stringify(new URL("../mirpanel-admin/server.mjs",import.meta.url).href)});`;
const child=spawn(process.execPath,["--input-type=module","-e",code],{windowsHide:true,env:{...process.env,PORT:String(port),ADMIN_USERNAME:username,ADMIN_PASSWORD:password,MIRPANEL_GITHUB_TOKEN:"synthetic",SUPABASE_URL:upstream,SUPABASE_SECRET_KEY:"synthetic",PAYMENT_TOKEN_SECRET_B64:key,PAYMENT_ENCRYPTION_KEY_B64:key,EMPLOYEE_PANEL_ENABLED:"false",COOKIE_SECURE:"false",RENDER_EXTERNAL_URL:origin,RENDER_GIT_COMMIT:"a".repeat(40)},stdio:["ignore","pipe","pipe"]});
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("fixture startup timeout")),12000);
    child.stdout.on("data", chunk=>{if(String(chunk).includes("Mirpanel admin:")){clearTimeout(timer);resolve();}});
    child.once("exit",()=>{clearTimeout(timer);reject(Error("fixture stopped"));});
  });
  let cookie, csrf;
  const req=(path,body)=>fetch(origin+path,{redirect:"manual",signal:AbortSignal.timeout(9000),method:body===undefined?"GET":"POST",headers:{Origin:origin,"content-type":"application/json",...(cookie?{Cookie:cookie,"X-CSRF-Token":csrf}:{} )},body:body===undefined?undefined:JSON.stringify(body)});
  const login=async()=>{const r=await req("/api/login",{username,password});assert.equal(r.status,200);cookie=r.headers.get("set-cookie").split(";")[0];csrf=(await (await req("/api/session")).json()).csrfToken;};
  const load=async()=>{const r=await req("/api/admin/state");assert.equal(r.status,200);return r.json();};
  const prepare=async(current,data)=>{const r=await req("/api/admin/preview",{baseSha:current.sha,data});assert.equal(r.status,200);return{baseSha:current.sha,previewDigest:(await r.json()).previewDigest,data};};
  const save=async p=>{const r=await req("/api/admin/save",p);assert.equal(r.status,200);return r.json();};
  const publicText=async path=>(await fetch(upstream+"/public/"+path)).text();
  const verify=async result=>(await (await req("/api/admin/deploy-status?"+new URLSearchParams({appSha:result.sha,commit:result.commitSha,version:result.version}))).json()).cloudflare.live;
  await login();
  const initial=await load();
  const changed=structuredClone(initial.data);
  const product=changed.products.find(p=>p.id==="hbomax");
  product.title="Isolated product confirmation";
  const p=await prepare(initial,changed);
  slow=true;loseRef=true;
  const response=save(p);
  const pending=await req("/api/admin/save-status?digest="+p.previewDigest);
  assert.equal(pending.status,200);
  const result=await response;
  assert.equal(writes,1,"lost Git ref acknowledgement must reconcile");
  assert.equal((await load()).data.products.find(p=>p.id==="hbomax").title,product.title);
  assert.equal((await (await req("/api/admin/save-status?digest="+p.previewDigest)).json()).publication.commitSha,result.commitSha);
  assert.equal((await save(p)).commitSha,result.commitSha);
  assert.equal(writes,1,"replaying the identical successful operation cannot create a commit");
  assert.equal(await verify(result),false);
  assert.ok(!(await publicText("app.js")).includes(product.title));
  live=head;
  assert.equal(await verify(result),true);
  assert.ok((await publicText(`mehsul/${product.seoSlug}.page`)).includes(product.title));
  const before=await load(), home=structuredClone(before.data);
  home.cms.homepage.announcement={...home.cms.homepage.announcement,enabled:true,text:"Isolated homepage confirmation"};
  const h=await prepare(before,home);
  sessions.clear();
  assert.equal((await req("/api/admin/save",h)).status,401);
  assert.equal(writes,1);
  await login();
  abortRead=true;
  assert.equal((await req("/api/admin/save",h)).ok,false);
  assert.equal(writes,1);
  const resumed=await prepare(await load(),home);
  const saved=await save(resumed);
  assert.equal((await load()).data.cms.homepage.announcement.text,home.cms.homepage.announcement.text);
  assert.equal(await verify(saved),false);
  live=head;
  assert.equal(await verify(saved),true);
  const deliveredCms=extractAdminState(await publicText("app.js")).cms;
  assert.equal(deliveredCms.homepage.announcement.text,home.cms.homepage.announcement.text);
  const announcement={textContent:""};
  vm.runInNewContext(fs.readFileSync("cms-site.js","utf8"),{
    CMS_CONTENT:deliveredCms,window:{addEventListener(){}},location:{pathname:"/fixture",origin:upstream},URL,clearTimeout,
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:selector=>selector===".banner-text"?[announcement]:[],addEventListener(){}}
  });
  assert.equal(announcement.textContent,home.cms.homepage.announcement.text);
  assert.equal(writes,2);
  console.log(JSON.stringify({product:"saved, reopened and generated customer page verified",homepage:"saved, reopened and delivered customer content verified",slow:true,lostGitAck:true,expiredSession:true,networkFailure:true,delayedDelivery:true,gitWrites:2,productionWrites:0}));
} finally {
  if(child.exitCode===null){const stopped=once(child,"exit");child.kill();await stopped;}
  await new Promise(resolve=>mock.close(resolve));
}
