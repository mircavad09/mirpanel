import {mountEpointWallet} from './epoint-wallet.js?v=google-preview-1';
const form=document.querySelector('[data-google-preview]');
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;};
const link=(text,href)=>{const n=el('a',text);n.href=href;return n;};
try{
 const r=await fetch('/api/payments/epoint/status?preview=google',{credentials:'same-origin',cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Yoxlama açılmadı.');
 await mountEpointWallet({form,accountId:data.accountId,getCents:()=>100,signal:new AbortController().signal,el,button,link,walletOnly:true,preview:true,fixedRequestId:data.requestId});
}catch(e){form.append(el('p',e.message),link('Hesabıma daxil ol','/hesab?next='+encodeURIComponent('/balans')));}
