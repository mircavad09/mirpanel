import {mountSupportDesk,supportSummaryPolling} from '/community-assets/private-support-staff.js?v=2';
if(!window.mirpanelPrivateSupportAdmin){window.mirpanelPrivateSupportAdmin=true;
 const api=async(action,body,query='')=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{
  const options={credentials:'same-origin',cache:'no-store',signal:c.signal};if(body){const r=await fetch('/api/session',options);if(!r.ok)throw Object.assign(Error('Admin sessiyası bitib.'),{status:r.status});Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':(await r.json()).csrfToken},body:JSON.stringify(body)});}
  const r=await fetch('/api/admin/community/support/'+action+query,options),d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Dəstək yüklənmədi.'),{status:r.status});return d;
 }finally{clearTimeout(timer);}};
 const bar=document.createElement('aside'),link=document.createElement('a');link.href='/admin.html#canli-destek';bar.hidden=true;(document.querySelector('.topbar')||document.body).append(bar);supportSummaryPolling({api,container:bar,link});
 const root=document.getElementById('liveSupportView');let desk;const open=()=>{if(!root)return;desk??=mountSupportDesk(root,{api,admin:true});void desk?.refresh();};window.addEventListener('admin-community-view',e=>{if(e.detail==='liveSupport')open();});if(['#liveSupport','#canli-destek'].includes(location.hash))open();
 const css=document.createElement('link');css.rel='stylesheet';css.href='/community-assets/private-support.css?v=2';document.head.append(css);
}
