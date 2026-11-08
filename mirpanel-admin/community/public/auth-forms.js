// Shared confirmation sheet; account forms themselves are only mounted on /hesab.
const confirmationKey='mirpanel:signup-confirmation';
const el=(tag,attrs={},...children)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined)e.setAttribute(k,String(v));e.append(...children);return e;};
const button=(label,click)=>{const b=el('button',{type:'button'},label);b.onclick=click;return b;};
async function loadAuthStyle(){
 const cssUrl='/community-assets/auth-forms.css?v=signup-manual-code-20261108';let css=document.querySelector('link[href="'+cssUrl+'"]');
 // A failed preload can expose an empty sheet, or fire before this module starts.
 // Require the form rules and bind load/error before inserting a fresh retry.
 const usable=sheet=>{try{return Array.from(sheet?.sheet?.cssRules||[]).some(r=>r.selectorText?.includes('.auth-form-panel'));}catch{return false;}};
 if(usable(css)){css.dataset.shellPersistent='auth-forms';css.disabled=false;}else{css?.remove();css=document.createElement('link');css.rel='stylesheet';css.href=cssUrl;css.dataset.shellPersistent='auth-forms';let timer;try{await new Promise((resolve,reject)=>{const fail=()=>reject(Error('Giriş formasının görünüşü yüklənmədi. Yenidən cəhd edin.'));css.addEventListener('load',()=>usable(css)?resolve():fail(),{once:true});css.addEventListener('error',fail,{once:true});timer=setTimeout(fail,12000);document.head.append(css);});}catch(e){css.remove();throw e;}finally{clearTimeout(timer);}}
}
async function accountApi(url,data,signal){
 const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal,redirect:'error'});
 if(!/^application\/json\b/i.test(r.headers.get('Content-Type')||''))throw Error('Hesab xidməti düzgün cavab vermədi. Yenidən cəhd edin.');
 const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error?.message||d.message||d.error||'Əməliyyat alınmadı.'),{code:d.code||d.error?.code});return d;
}
function openVerification({pending,host,life,verificationApi,finish,readableError,afterSignup=false,checkout=false,created=false,onClose}){
 const dialog=el('dialog',{class:'auth-code-sheet','aria-labelledby':'authCodeTitle'});let working=false,clock,attempted=false;
  const stop=()=>{clearInterval(clock);dialog.remove();};
  dialog.addEventListener('close',()=>{stop();onClose?.();},{once:true});
  life.signal.addEventListener('abort',stop,{once:true});
  const close=button('×',()=>{if(!working)dialog.close();});close.className='auth-code-close';close.setAttribute('aria-label','Bağla');
  const title=el('h2',{id:'authCodeTitle'}),feedback=el('p',{class:'auth-code-error',role:'alert'}),contents=el('div',{class:'auth-code-content'});
  dialog.append(close,el('div',{class:'auth-code-icon','aria-hidden':'true'},'✉'),title,contents,feedback);host.append(dialog);
  function draw(s,editing=false){
   clearInterval(clock);contents.replaceChildren();feedback.textContent='';
   const withCode=s.codeSent&&!editing;title.textContent=checkout?'Sifarişinizi tamamlamaq üçün e-poçtunuzu təsdiqləyin':withCode?'Kodu daxil edin':afterSignup?'Sifarişinizi tamamlamaq üçün e-poçtunuzu təsdiqləyin':'E-poçtunu təsdiqlə';
   const change=button('Dəyiş',()=>{if(!working)draw(s,true);});change.className='auth-code-secondary';
   const address=el('div',{class:'auth-code-address'},el('div',{},el('small',{},withCode?'Kod göndərilən e-poçt':'Qeyd etdiyin e-poçt'),el('strong',{},s.email)),change);
   async function run(action,data,control,onSuccess){
    if(working)return;working=true;close.disabled=true;control.disabled=true;feedback.textContent='';let succeeded=false;
    try{const response=await verificationApi(action,data);succeeded=true;if(dialog.open)await onSuccess(response);}
    catch(e){
     if(!dialog.open)return;
     if(action==='send'){
      // The provider may have accepted the message before the response was lost.
      try{const current=await verificationApi('status');if(current.email&&dialog.open){draw(current);succeeded=true;if(current.codeSent)return;}}catch{}
     }
     feedback.textContent=readableError(e);
    }
    finally{working=false;close.disabled=false;if(!succeeded&&control.isConnected)control.disabled=false;}
   }
   if(editing){
    const edit=el('form',{class:'auth-code-edit'}),input=el('input',{type:'email',value:s.email,required:true,maxlength:254,'aria-label':'Yeni e-poçt ünvanı',autocomplete:'email'}),save=el('button',{type:'submit',class:'auth-code-primary'},'Yadda saxla');
    edit.append(input,save);edit.onsubmit=e=>{e.preventDefault();if(edit.reportValidity())void run('change',{email:input.value},save,draw);};contents.append(edit);if(dialog.open)input.focus();return;
   }
   if(afterSignup&&created)contents.append(el('p',{class:'auth-code-copy',role:'status'},'Hesabınız yaradılıb'));
   contents.append(el('p',{class:'auth-code-copy'},withCode&&afterSignup?'Kod göndərildi. E-poçtuna gələn 6 rəqəmli kodu daxil et.':withCode?'E-poçtuna 6 rəqəmli kod göndərdik.':'Sifariş vermək üçün e-poçtunu təsdiqləməlisən. Cəmi 1 dəqiqə çəkir.'));
   if(!withCode)contents.append(el('span',{class:'auth-code-badge'},'Sifariş üçün vacibdir'));
   contents.append(address);
   if(!withCode)contents.append(el('p',{class:'auth-code-notice'},'Kod e-poçtuna gələcək. Gələnlər qutusunu yoxla.'));
   const cells=[];let confirm;
   const refresh=()=>{confirm.disabled=cells.some(i=>!/^\d$/.test(i.value));};
   if(withCode){
    const grid=el('div',{class:'auth-code-grid',role:'group','aria-label':'6 rəqəmli təsdiq kodu'});
    const fillCode=(raw,start)=>{const digits=raw.replace(/\D/g,'').slice(0,6);if(digits.length===6)start=0;for(let n=0;n<digits.length&&start+n<6;n++)cells[start+n].value=digits[n];cells[Math.min(5,start+digits.length)].focus();refresh();};
    for(let i=0;i<6;i++){
     const cell=el('input',{type:'text',inputmode:'numeric',autocomplete:i===0?'one-time-code':'off','aria-label':(i+1)+'-ci rəqəm',pattern:'[0-9]'});
     cell.oninput=()=>{const raw=cell.value;cell.value='';if(raw)fillCode(raw,i);else refresh();};
     cell.onpaste=e=>{e.preventDefault();fillCode(e.clipboardData.getData('text'),i);};
     cell.onkeydown=e=>{if(e.key==='Backspace'&&!cell.value&&i>0){cells[i-1].value='';cells[i-1].focus();refresh();}if(e.key==='Enter'&&!confirm.disabled)confirm.click();};
     cells.push(cell);grid.append(cell);
    }
    contents.append(grid);
   }
   const send=button('',()=>{attempted=true;void run('send',{},send,draw);});
   send.className=withCode?'auth-code-resend':'auth-code-primary';
   const end=Date.now()+Math.max(0,s.retryAfter||0)*1000,tick=()=>{const n=Math.max(0,Math.ceil((end-Date.now())/1000));if(!working)send.disabled=n>0;send.textContent=(withCode?'Təkrar kod göndər':attempted||s.retryAfter?'Kodu yenidən göndər':'Kod göndər')+(n?' · '+n+' san.':'');};
   send.disabled=end>Date.now();tick();if(end>Date.now())clock=setInterval(tick,250);
   contents.append(send);
   if(withCode){confirm=button('Təsdiqlə',()=>void run('verify',{code:cells.map(c=>c.value).join('')},confirm,async()=>{dialog.close();await finish();}));confirm.className='auth-code-primary';confirm.disabled=true;contents.append(confirm);if(dialog.open)cells[0].focus();}
  }
  draw(pending);dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});dialog.showModal();dialog.querySelector('.auth-code-grid input')?.focus();
  return dialog;
 }

let confirmationOpening;
export function requestEmailConfirmation({checkout=false,signal,onVerified=()=>location.reload()}={}){
 if(signal?.aborted||document.querySelector('.auth-code-sheet[open]'))return Promise.resolve();
 if(confirmationOpening)return confirmationOpening;
 const life=new AbortController();
 signal?.addEventListener('abort',()=>life.abort(),{once:true,signal:life.signal});
 window.addEventListener('mirpanel:route-leave',()=>life.abort(),{once:true,signal:life.signal});
 window.addEventListener('pagehide',()=>life.abort(),{once:true,signal:life.signal});
 const verificationApi=(action,data={})=>accountApi('/api/auth/confirm-email/'+action,data,life.signal);
 confirmationOpening=(async()=>{
  await loadAuthStyle();
  const pending=await verificationApi('status');
  if(life.signal.aborted)return;
  if(pending.verified){await onVerified();return;}
  if(!pending.email)throw Error('Hesabınıza daxil olun və e-poçtunuzu təsdiqləyin.');
  if(!document.querySelector('.auth-code-sheet[open]'))openVerification({pending,host:document.body,life,verificationApi,finish:onVerified,readableError:e=>e.message,checkout,onClose:()=>life.abort()});
 })().finally(()=>{confirmationOpening=null;if(!document.querySelector('.auth-code-sheet[open]'))life.abort();});
 return confirmationOpening;
}

export async function resumeSignupConfirmation(){
 let marker;
 try{marker=JSON.parse(sessionStorage.getItem(confirmationKey));}catch{return;}
 if(!marker||marker.path!==location.pathname||document.querySelector('.auth-code-sheet'))return;
 const life=new AbortController();
 const verificationApi=(action,data={})=>accountApi('/api/auth/confirm-email/'+action,data,life.signal);
 const clear=()=>sessionStorage.removeItem(confirmationKey);
 const finish=()=>{clear();location.reload();};
 const readableError=e=>e.message||'Əməliyyat alınmadı. Yenidən cəhd edin.';
 const recovery='/hesab?mode=login&next='+encodeURIComponent(marker.path)+(marker.path==='/sebet'?'&from=cart':'');
 let pending;
 try{await loadAuthStyle();pending=await verificationApi('status');}catch{}
 if(pending?.verified){clear();return;}
 if(!pending?.email){
  const dialog=el('dialog',{class:'auth-code-sheet','aria-labelledby':'authCodeTitle'},el('h2',{id:'authCodeTitle'},'E-poçt təsdiqi'),...(marker.created?[el('p',{role:'status'},'Hesabınız yaradılıb')]:[]),el('p',{role:'alert'},'Təsdiq sessiyası açıla bilmədi. Hesabınıza daxil olaraq davam edə bilərsiniz.'));
  dialog.append(button('Yenidən yoxla',()=>{dialog.remove();void resumeSignupConfirmation();}),el('a',{href:recovery},'Daxil ol və təsdiqə davam et'),button('Bağla',()=>dialog.close()));
  dialog.addEventListener('close',()=>{clear();dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();return;
 }
 openVerification({pending,host:document.body,life,verificationApi,finish,readableError,afterSignup:true,created:marker.created,onClose:clear});
}
export async function renderAuthForms({app,state,api,el,button,link,alert,signal}){
 const policy=state.authFormPolicy||{minPasswordLength:6,maxPasswordLength:128,termsUrl:'/sertler',privacyUrl:'/sertler#sertler-10'};
 document.body.classList.add('auth-screen');await loadAuthStyle();
 if(signal?.aborted||!app.isConnected)return;
 const params=new URLSearchParams(location.search),next=params.get('next')||'',destination=['/','/profil','/qrup','/mehsul','/sebet','/sifarislerim','/balans','/odenis','/balans?returnTo=%2Fodenis%3Fmode%3Dwallet'].includes(next)||/^\/mehsul\/[a-z0-9-]+$/i.test(next)||/^\/profil\?tab=(?:orders(?:&order=[A-Za-z0-9-]{1,40})?|codes|payments|subscriptions|expenses)$/.test(next)?next:'/profil',requested=params.get('mode')||'login',mode=['login','signup','reset','new-password'].includes(requested)?requested:'login';
 const fromCart=params.get('from')==='cart'&&destination==='/sebet';
 const referrer=(()=>{try{const u=new URL(document.referrer);return u.origin===location.origin?u.pathname:'';}catch{return '';}})();
 const signupDestination=destination==='/sebet'?'/sebet':/^\/mehsul\/[a-z0-9-]+$/i.test(destination)?destination:/^\/mehsul\/[a-z0-9-]+$/i.test(referrer)?referrer:'/';
 const cartLogin=fromCart&&mode==='login';
 const titles={signup:'Qeydiyyat',login:fromCart?'Daxil ol':'Giriş',reset:'Şifrə bərpası','new-password':'Yeni şifrə'},title=titles[mode];document.title=title+' · MirPanel';
 const error=alert();error.classList.add('auth-feedback');error.setAttribute('role','alert');const success=el('p',{class:'auth-success',role:'status','aria-live':'polite'}),form=el('form',{class:'auth-fields'}),fields={};let busy=false;
 const fieldFeedback={},signup=mode==='signup';let pendingSignup=null,recover,loginRecovery;
 if(params.has('error'))error.textContent=params.get('error')==='account_not_linked'?'Bu e-poçt hesabını əvvəlcə təsdiqləyin. Google ilə yalnız təsdiqlənmiş eyni e-poçt əlaqələndirilə bilər.':params.get('error')==='test_identity_not_allowed'?'Bu Google hesabı test girişinə əlavə edilməyib.':'Google girişi tamamlanmadı. Yenidən cəhd edin.';
 const closeTo=fromCart?'/sebet':destination.startsWith('/balans')?destination:'/qrup',close=link('×',closeTo,'auth-close');close.setAttribute('aria-label',fromCart?'Bağla və səbətə qayıt':closeTo==='/qrup'?'Bağla və qrupa qayıt':'Bağla və balans səhifəsinə qayıt');
 const panel=el('section',{class:'auth-form-panel'+(cartLogin?' auth-cart-login':''),'aria-labelledby':cartLogin?'authCartWelcome':'authTitle'},close,el('header',{class:'auth-form-heading'},el(cartLogin?'h2':'h1',{id:'authTitle'},title)));
 const target=m=>'/hesab?mode='+m+'&next='+encodeURIComponent(m==='signup'&&signupDestination.startsWith('/mehsul/')?signupDestination:destination)+(fromCart?'&from=cart':'');
 const tabs=el('nav',{class:'auth-mode-tabs','aria-label':'Hesab formaları'});for(const [id,label] of [['login','Giriş'],['signup','Qeydiyyat']]){const a=link(label,target(id));if(mode===id)a.setAttribute('aria-current','page');tabs.append(a);}panel.prepend(tabs);
 function field(key,label,type,attrs={}){const id='account-'+key,i=el('input',{id,name:key,type,required:true,...attrs}),box=el('div',{class:'auth-field'},el('label',{for:id},label),i);fields[key]=i;return{box,input:i};}
 function password(label){const{box,input}=field('password',label,'password',{minlength:mode==='login'?undefined:policy.minPasswordLength,maxlength:policy.maxPasswordLength,autocomplete:mode==='login'?'current-password':'new-password',placeholder:mode==='login'?'Şifrənizi daxil edin':`Ən azı ${policy.minPasswordLength} simvol`});
  const toggle=button('',()=>{const shown=input.type==='password';input.type=shown?'text':'password';toggle.setAttribute('aria-label',shown?'Şifrəni gizlət':'Şifrəni göstər');toggle.setAttribute('aria-pressed',String(shown));input.focus({preventScroll:true});});toggle.className='auth-password-toggle';toggle.setAttribute('aria-label','Şifrəni göstər');toggle.setAttribute('aria-pressed','false');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z');svg.append(p);toggle.append(svg);
  const control=el('div',{class:'auth-password-control'},input,toggle);box.append(control);return box;
 }
 const divider=text=>el('div',{class:'auth-divider'},el('span',{},text));
 const signupFields=['firstName','lastName','email','phone','password','termsAccepted'];
 const requiredMessage={firstName:'Adınızı yazın.',lastName:'Soyadınızı yazın.',email:'E-poçt ünvanınızı yazın.',phone:'Telefon nömrənizi yazın.',password:'Şifrənizi yazın.',termsAccepted:'Davam etmək üçün istifadə şərtlərini qəbul edin.'};
 function setFieldError(key,message=''){
  const input=fields[key],feedback=fieldFeedback[key];if(!input||!feedback)return;
  feedback.textContent=message;feedback.hidden=!message;
  if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
 }
 function validateSignup(keys){
  let first;
  for(const key of keys){
   const input=fields[key],v=input.validity;
   const msg=v.valueMissing||input.type!=='checkbox'&&key!=='password'&&!input.value.trim()?requiredMessage[key]:
    key==='email'&&v.typeMismatch?'Düzgün e-poçt ünvanı yazın.':
    key==='phone'&&v.patternMismatch?'Telefon nömrəsində yalnız rəqəm, boşluq və ()-. işarələri istifadə edin.':
    key==='password'&&input.value.length<policy.minPasswordLength?`Şifrə ən azı ${policy.minPasswordLength} simvol olmalıdır.`:
    key==='password'&&input.value.length>policy.maxPasswordLength?`Şifrə ən çox ${policy.maxPasswordLength} simvol ola bilər.`:'';
   setFieldError(key,msg);if(msg&&!first)first=input;
  }
  if(first){first.focus();return false;}return true;
 }
 const errorFields={REGISTRATION_FIELD_FIRST_NAME:'firstName',REGISTRATION_FIELD_LAST_NAME:'lastName',REGISTRATION_FIELD_EMAIL:'email',REGISTRATION_FIELD_PHONE:'phone',REGISTRATION_FIELD_COUNTRY:'countryCode',REGISTRATION_FIELD_TERMS:'termsAccepted',INVALID_EMAIL:'email',PASSWORD_TOO_SHORT:'password',PASSWORD_TOO_LONG:'password',INVALID_PASSWORD:'password'};
 const signupErrorText={INVALID_EMAIL:'Düzgün e-poçt ünvanı yazın.',PASSWORD_TOO_LONG:`Şifrə ən çox ${policy.maxPasswordLength} simvol ola bilər.`,INVALID_PASSWORD:'Düzgün şifrə yazın.'};
 const readableError=e=>{const m=String(e.message||'');if(/invalid email or password|invalid credentials|incorrect password/i.test(m))return'E-poçt və ya şifrə düzgün deyil.';if(/email.*not verified|verify your email/i.test(m))return'Əvvəlcə e-poçtunuzu təsdiqləyin.';if(/password.*short/i.test(m))return`Şifrə ən azı ${policy.minPasswordLength} simvol olmalıdır.`;if(/too many|rate limit/i.test(m))return'Çox cəhd edildi. Bir az gözləyib yenidən cəhd edin.';if(/fetch|network|unexpected|failed to create user/i.test(m))return'Serverə qoşulmaq mümkün olmadı. Yenidən cəhd edin.';return m||'Əməliyyat alınmadı. Yenidən cəhd edin.';};
 // Unmodified official asset: https://developers.google.com/static/identity/images/g-logo.png
 function google(){const g=button('',async()=>{if(busy||g.disabled)return;busy=true;g.disabled=true;try{const r=await api('/api/auth/sign-in/social',{provider:'google',callbackURL:location.origin+destination});if(r.url)location.assign(r.url);}catch(e){error.textContent=readableError(e);}finally{busy=false;g.disabled=!state.googleEnabled;}});g.className='auth-google';g.append(el('img',{class:'auth-google-g',src:'/community-assets/google-g.png',width:20,height:20,alt:''}),el('span',{},'Google ilə davam edin'));g.disabled=!state.googleEnabled;
  const wrap=el('div',{class:'auth-google-block'},g);if(!state.googleEnabled)wrap.append(el('small',{class:'auth-google-reason'},state.googleDisabledReason||'Google girişi hazırda əlçatan deyil.'));return wrap;
 }
 if(mode==='signup'){
  panel.append(google(),divider('və ya e-poçt ilə'));
  const first=field('firstName','Ad','text',{placeholder:'Adınız',autocomplete:'given-name',maxlength:40}),last=field('lastName','Soyad','text',{placeholder:'Soyadınız',autocomplete:'family-name',maxlength:50});form.append(el('div',{class:'auth-name-row'},first.box,last.box));
 }
 if(mode!=='new-password'){const email=field('email','E-poçt','email',{placeholder:'ad@mail.com',autocomplete:'username',autocapitalize:'none',spellcheck:'false'});form.append(email.box);}
 if(mode==='signup'){
  const select=el('select',{id:'account-countryCode',name:'countryCode','aria-label':'Ölkə kodu',autocomplete:'tel-country-code'});for(const[code,name]of [['994','Azərbaycan'],['90','Türkiyə'],['995','Gürcüstan'],['7','Rusiya'],['1','ABŞ'],['44','Böyük Britaniya'],['49','Almaniya']])select.append(el('option',{value:code,label:'+'+code},'+'+code+' · '+name));fields.countryCode=select;
  const phone=field('phone','Telefon nömrəsi','tel',{placeholder:'50 123 45 67',autocomplete:'tel-national',inputmode:'tel',maxlength:25,pattern:String.raw`[0-9 \(\)\-.]{5,25}`});phone.box.append(el('div',{class:'auth-phone-control'},select,phone.input));form.append(phone.box);
 }
 if(mode!=='reset')form.append(password(mode==='new-password'?'Yeni şifrə':'Şifrə'));
 if(mode==='signup'){
  const check=el('input',{type:'checkbox',id:'account-terms',name:'termsAccepted',required:true});fields.termsAccepted=check;
  const terms=link('İstifadə şərtlərini',policy.termsUrl,'auth-legal-link'),privacy=link('məxfilik bölməsini',policy.privacyUrl,'auth-legal-link');for(const a of [terms,privacy]){a.target='_blank';a.rel='noopener noreferrer';}
  form.append(el('label',{class:'auth-consent',for:'account-terms'},check,el('span',{},terms,' qəbul edirəm və ',privacy,' oxudum.')));
 }
 if(mode==='login')form.append(link('Şifrəmi unutdum',fromCart?target('reset'):'/hesab?mode=reset','auth-forgot'));
 const submit=el('button',{type:'submit',class:'auth-submit '+(mode==='signup'?'auth-submit-signup':'')},mode==='signup'?'Qeydiyyatdan keç':mode==='login'?'Daxil ol':mode==='reset'?'Bərpa keçidini göndər':'Şifrəni yenilə');if(['login','signup'].includes(mode)){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 21v-2a8 8 0 0 1 16 0v2'+(mode==='signup'?'M21 8v6m-3-3h6':''));svg.append(path);submit.prepend(svg);}form.append(error,success,submit);
 const submitLabel=submit.lastChild;
 const matchingSignup=()=>pendingSignup&&pendingSignup.email===fields.email.value.trim().toLowerCase();
 function updateSignupAction(){submitLabel.textContent=matchingSignup()?'Təsdiqə davam et':'Qeydiyyatdan keç';}
 if(signup){
  form.noValidate=true;
  for(const key of [...signupFields,'countryCode']){
   const input=fields[key],id=input.id+'-error',feedback=el('p',{id,class:'auth-field-error',role:'alert'});
   feedback.hidden=true;fieldFeedback[key]=feedback;input.setAttribute('aria-describedby',id);
   const group=input.closest('.auth-field')||input.closest('.auth-consent');
   if(key==='termsAccepted')group.after(feedback);else group.append(feedback);
   input.addEventListener('input',()=>{setFieldError(key);if(key==='email')updateSignupAction();});
  }
  recover=button('Mövcud hesabın təsdiqinə davam et',()=>void submitSignup(true));recover.className='auth-resend';recover.hidden=true;loginRecovery=link('Daxil ol',target('login'),'auth-legal-link');loginRecovery.hidden=true;form.append(recover,loginRecovery);
 }
 async function submitSignup(resume=false){
  if(busy)return;
  error.textContent='';success.textContent='';loginRecovery.hidden=true;
  const known=matchingSignup(),continuing=resume||!!known;
  if(!validateSignup(continuing?['email','password']:signupFields))return;
  busy=true;submit.disabled=recover.disabled=true;submit.setAttribute('aria-busy','true');
  const values=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.type==='checkbox'?v.checked:v.value.trim()]));
  values.password=fields.password.value;
  try{
   let created=known;
   if(!continuing){
    const result=await api('/api/auth/sign-up/email',{...values,name:values.firstName+' '+values.lastName,registrationForm:true,callbackURL:location.origin+destination});
    if(!result?.user?.id||!result.user.email)throw Error('Qeydiyyat cavabı təsdiqlənmədi.');
    // During a staggered release an older origin may omit the creation
    // flag. In that case only password + matching user ID proves creation.
    if(result.registrationCreated!==true){
     await startVerification({email:result.user.email,password:values.password,createdUserId:result.user.id},{returnAfterSignup:true,created:true});
     return;
    }
    created=pendingSignup={id:result.user.id,email:result.user.email};
   }
   if(created)success.textContent='Hesabınız yaradılıb';
   // A known creation retries only verification. After an unknown/duplicate
   // response, explicit recovery checks the existing account's password.
   await startVerification({email:created?.email||values.email,password:values.password,...(!resume&&created?{createdUserId:created.id}:{})},{returnAfterSignup:true,created:!!created});
   recover.hidden=true;
  }catch(e){
   const key=errorFields[e.code];
   if(key&&!continuing){setFieldError(key,signupErrorText[e.code]||readableError(e));fields[key].focus();}
   else{
    error.textContent=continuing?'Təsdiq açıla bilmədi. '+readableError(e):matchingSignup()?'Təsdiq açıla bilmədi. Yenidən qeydiyyatdan keçmədən təsdiqə davam edə bilərsiniz.':readableError(e);
    loginRecovery.hidden=false;
    recover.hidden=e.code==='REGISTRATION_GOOGLE_ONLY';
   }
  }finally{busy=false;submit.disabled=recover.disabled=false;submit.removeAttribute('aria-busy');updateSignupAction();}
 }

 form.addEventListener('submit',async e=>{e.preventDefault();if(signup)return submitSignup();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');error.textContent='';success.textContent='';try{const values=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.type==='checkbox'?v.checked:v.value.trim()]));if(fields.password)values.password=fields.password.value;
  if(mode==='login'){try{await api('/api/auth/sign-in/email',{email:values.email,password:values.password});}catch(e){if(!/email.*not verified|verify your email/i.test(String(e.message)))throw e;await startVerification({email:values.email,password:values.password});return;}fields.password.value='';await finish();}
  else if(mode==='reset'){await api('/api/auth/request-password-reset',{email:values.email,redirectTo:location.origin+'/hesab?mode=new-password'});success.textContent='Hesab mövcuddursa, bərpa keçidi göndərildi.';}
  else{await api('/api/auth/reset-password',{token:params.get('token'),newPassword:values.password});fields.password.value='';if(window.MirpanelNavigation)await window.MirpanelNavigation.go('/hesab');else location.assign('/hesab');}
 }catch(e){error.textContent=readableError(e);}finally{busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}});
 panel.append(form);if(mode==='login')panel.append(divider('və ya'),google());
 const footer=el('div',{class:'auth-form-footer'},el('span',{},mode==='signup'?'Artıq hesabın var?':mode==='login'?'Hesabınız yoxdur?':'Girişə qayıt'),link(mode==='signup'?'Daxil ol →':mode==='login'?'Qeydiyyatdan keç →':'Giriş →',target(mode==='login'?'signup':'login'),'auth-switch'));panel.append(footer);
 const life=new AbortController();window.mirpanelAuthDispose=()=>life.abort();
 signal?.addEventListener('abort',()=>life.abort(),{once:true});
 const verificationApi=(action,data={})=>api('/api/auth/confirm-email/'+action,data);
 async function startVerification(data,{returnAfterSignup=false,created=false}={}){
  const pending=await verificationApi('start',data);
  if(!pending.email)throw Error('Təsdiq sessiyası açıla bilmədi. Yenidən cəhd edin və ya hesabınıza daxil olun.');
  fields.password.value='';
  if(returnAfterSignup)returnToConfirmation(pending,created);
  else await finish();
 }
 function returnToConfirmation(pending,created=false){
  try{sessionStorage.setItem(confirmationKey,JSON.stringify({path:signupDestination,created}));}
  catch{showVerification(pending);return;}
  location.assign(signupDestination);
 }
 const finish=async()=>{await window.refreshCommunityNav?.();if(window.MirpanelNavigation)await window.MirpanelNavigation.go(destination);else location.assign(destination);};
 let verification;
 function showVerification(pending){
  if(!pending?.email||life.signal.aborted)return;
  verification?.close();
  verification=openVerification({pending,host:app,life,verificationApi,finish,readableError});
 }
 app.replaceChildren(panel);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy&&!verification?.open){if(window.MirpanelNavigation)void window.MirpanelNavigation.go(closeTo);else location.assign(closeTo);}},{signal:life.signal});
 if(mode==='login')void verificationApi('status').then(p=>{if(!busy&&!verification?.open)showVerification(p);}).catch(()=>{});
 if(signup)void verificationApi('status').then(p=>{
  if(p?.email&&!life.signal.aborted){
   const resume=button('Təsdiqə davam et',()=>{if(!busy)returnToConfirmation(p);});
   resume.className='auth-resend';form.append(resume);
  }
 }).catch(()=>{});
 if(fromCart&&['login','signup'].includes(mode)){
  const summary=el('section',{class:'auth-order-summary','aria-label':'Səbət xülasəsi'}),count=el('strong',cartLogin?{'aria-live':'polite'}:{},'Səbət'),rows=el('div',{class:'auth-order-rows'}),hint=el('p',{},'Sifarişi tamamlamaq üçün daxil olun. Səbətiniz itmir — girişdən sonra hesabınıza köçürülür.');
  if(cartLogin){
   const welcome=el('header',{class:'auth-cart-welcome'},el('h1',{id:'authCartWelcome'},'Xoş gəldin 👋'),el('p',{},'Daxil ol — aldığın hesablar və kodlar profilində qalır, balansla bir toxunuşla ödəyə bilərsən.'));
   const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
   const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M2 3h2l2.5 12h12l2-8H5m4 13h.01m8 0h.01');icon.append(path);
   summary.append(el('div',{class:'auth-order-heading'},icon,count),rows);hint.className='auth-cart-hint';
   tabs.before(welcome,summary,hint);
  }else{summary.append(count,rows,hint);tabs.before(summary);}
  const money=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
  async function loadSummary(){
   rows.replaceChildren();try{
    const {ensureCart}=await import('/cart-ready.js?v=account-update-20261107'),cart=await ensureCart(),items=cart.read();
    const quantity=items.reduce((n,x)=>n+x.quantity,0);count.textContent=cartLogin?'Səbətinizdə '+quantity+' məhsul':quantity+' məhsul';
    if(!quantity||life.signal.aborted)return;
    const r=await fetch('/api/payments/shop/quote',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),signal:life.signal});
    if(!r.ok||!/^application\/json\b/i.test(r.headers.get('Content-Type')||''))throw Error();
    const q=await r.json();
    if(!Number.isSafeInteger(q.totalCents)||!Array.isArray(q.items)||q.items.length!==items.length)throw Error();
    if(cartLogin)count.replaceChildren('Səbətinizdə '+quantity+' məhsul · ',el('span',{class:'auth-order-total'},money(q.totalCents)));
    else count.textContent=quantity+' məhsul · Cəmi '+money(q.totalCents);
    for(const x of q.items){const img=el('img',{src:x.image||'/favicon.ico',alt:'',width:40,height:40}),detail=el('div',{},el('strong',{},x.title),el('small',{},x.planName)),price=el('b',{},money(x.unitCents)+(x.quantity>1?' × '+x.quantity:''));rows.append(el('article',{},img,detail,price));}
   }catch{if(!life.signal.aborted)rows.replaceChildren(button('Səbəti yenidən yoxla',loadSummary));}
  }
  void loadSummary();
 }
 // Only account forms scroll. Keep the focused field and existing navigation
 // above the visual viewport's keyboard without locking the long signup form.
 function visibleField(){const v=window.visualViewport;document.body.style.setProperty('--auth-keyboard-inset',Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px');const active=document.activeElement;if(!form.contains(active)||!active.matches('input,select'))return;const nav=document.querySelector('.community-bottom-nav'),reserved=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0,r=active.getBoundingClientRect(),top=(v?.offsetTop||0)+12,bottom=(v?.offsetTop||0)+(v?.height||innerHeight)-reserved-14;if(r.bottom>bottom)window.scrollBy(0,r.bottom-bottom);else if(r.top<top)window.scrollBy(0,r.top-top);}
 const resized=()=>requestAnimationFrame(visibleField);window.visualViewport?.addEventListener('resize',resized,{signal:life.signal});window.addEventListener('resize',resized,{signal:life.signal});form.addEventListener('focusin',resized,{signal:life.signal});visibleField();
}

export function mountAuth(app){
 const life=new AbortController();
 const link=(label,href,cls)=>el('a',{href,class:cls},label);
 const api=(url,data)=>accountApi(url,data,life.signal);
 const dispose=()=>{life.abort();document.body.classList.remove('auth-screen');};
 void renderAuthForms({app,state:{googleEnabled:true},api,el,button,link,alert:()=>el('p'),signal:life.signal}).catch(e=>{if(!life.signal.aborted&&app.isConnected)app.replaceChildren(el('p',{role:'alert'},e.message),button('Yenidən cəhd et',()=>location.reload()));});
 return dispose;
}
const initial=document.getElementById('authApp');if(initial&&!window.mirpanelNavigationMounting)window.mirpanelPageDispose=mountAuth(initial);
