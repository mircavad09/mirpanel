// Only /hesab. Existing group/profile/checkout controllers are not restyled.
export async function renderAuthForms({app,state,api,el,button,link,alert}){
 const policy=state.authFormPolicy;if(!policy)throw Error('Giriş forması ayarları yüklənmədi. Səhifəni yeniləyin.');
 document.body.classList.add('auth-screen');const css=document.createElement('link');css.rel='stylesheet';css.href='/community-assets/auth-forms.css';const ready=new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=()=>reject(Error('Giriş formasının görünüşü yüklənmədi. Yenidən cəhd edin.'));});document.head.append(css);await ready;
 const params=new URLSearchParams(location.search),destination=params.get('next')==='/sifarislerim'?'/sifarislerim':'/profil',requested=params.get('mode')||'login',mode=['login','signup','reset','new-password'].includes(requested)?requested:'login';
 const titles={signup:'Qeydiyyat',login:'Giriş',reset:'Şifrə bərpası','new-password':'Yeni şifrə'},title=titles[mode];document.title=title+' · MirPanel';
 const error=alert();error.classList.add('auth-feedback');error.setAttribute('role','alert');const success=el('p',{class:'auth-success',role:'status','aria-live':'polite'}),form=el('form',{class:'auth-fields'}),fields={};let busy=false;
 if(params.has('error'))error.textContent=params.get('error')==='account_not_linked'?'Bu e-poçt hesabını əvvəlcə təsdiqləyin. Google ilə yalnız təsdiqlənmiş eyni e-poçt əlaqələndirilə bilər.':params.get('error')==='test_identity_not_allowed'?'Bu Google hesabı test girişinə əlavə edilməyib.':'Google girişi tamamlanmadı. Yenidən cəhd edin.';
 const close=link('×','/qrup','auth-close');close.setAttribute('aria-label','Bağla və qrupa qayıt');
 const panel=el('section',{class:'auth-form-panel','aria-labelledby':'authTitle'},close,el('header',{class:'auth-form-heading'},el('h1',{id:'authTitle'},title)));
 function field(key,label,type,attrs={}){const id='account-'+key,i=el('input',{id,name:key,type,required:true,...attrs}),box=el('div',{class:'auth-field'},el('label',{for:id},label),i);fields[key]=i;return{box,input:i};}
 function password(label){const{box,input}=field('password',label,'password',{minlength:mode==='login'?undefined:policy.minPasswordLength,maxlength:policy.maxPasswordLength,autocomplete:mode==='login'?'current-password':'new-password',placeholder:mode==='login'?'Şifrənizi daxil edin':`Ən azı ${policy.minPasswordLength} simvol`});
  const toggle=button('',()=>{const shown=input.type==='password';input.type=shown?'text':'password';toggle.setAttribute('aria-label',shown?'Şifrəni gizlət':'Şifrəni göstər');toggle.setAttribute('aria-pressed',String(shown));input.focus({preventScroll:true});});toggle.className='auth-password-toggle';toggle.setAttribute('aria-label','Şifrəni göstər');toggle.setAttribute('aria-pressed','false');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z');svg.append(p);toggle.append(svg);
  const control=el('div',{class:'auth-password-control'},input,toggle);box.append(control);if(mode!=='login')box.append(el('small',{class:'auth-field-help'},`Ən azı ${policy.minPasswordLength} simvol, maksimum ${policy.maxPasswordLength} simvol.`));return box;
 }
 const divider=text=>el('div',{class:'auth-divider'},el('span',{},text));
 const readableError=e=>{const m=String(e.message||'');if(/invalid email or password|invalid credentials|incorrect password/i.test(m))return'E-poçt və ya şifrə düzgün deyil.';if(/email.*not verified|verify your email/i.test(m))return'Əvvəlcə e-poçtunuzu təsdiqləyin.';if(/password.*short/i.test(m))return`Şifrə ən azı ${policy.minPasswordLength} simvol olmalıdır.`;if(/too many|rate limit/i.test(m))return'Çox cəhd edildi. Bir az gözləyib yenidən cəhd edin.';if(/fetch|network|unexpected|failed to create user/i.test(m))return'Serverə qoşulmaq mümkün olmadı. Yenidən cəhd edin.';return m||'Əməliyyat alınmadı. Yenidən cəhd edin.';};
 function google(){const g=button('',async()=>{if(busy||g.disabled)return;busy=true;g.disabled=true;try{const r=await api('/api/auth/sign-in/social',{provider:'google',callbackURL:location.origin+destination});if(r.url)location.assign(r.url);}catch(e){error.textContent=readableError(e);}finally{busy=false;g.disabled=!state.googleEnabled;}});g.className='auth-google';g.append(el('span',{class:'auth-google-g','aria-hidden':'true'},'G'),el('span',{},'Google ilə davam edin'));g.disabled=!state.googleEnabled;
  const wrap=el('div',{class:'auth-google-block'},g);if(!state.googleEnabled)wrap.append(el('small',{class:'auth-google-reason'},state.googleDisabledReason||'Google girişi hazırda əlçatan deyil.'));return wrap;
 }
 if(mode==='signup'){
  panel.append(google(),divider('və ya e-poçt ilə'));
  const first=field('firstName','Ad','text',{placeholder:'Adınız',autocomplete:'given-name',maxlength:40}),last=field('lastName','Soyad','text',{placeholder:'Soyadınız',autocomplete:'family-name',maxlength:50});form.append(el('div',{class:'auth-name-row'},first.box,last.box));
 }
 if(mode!=='new-password'){const email=field('email','E-poçt','email',{placeholder:'ad@mail.com',autocomplete:'username',autocapitalize:'none',spellcheck:'false'});form.append(email.box);}
 if(mode==='signup'){
  const select=el('select',{id:'account-countryCode',name:'countryCode','aria-label':'Ölkə kodu',autocomplete:'tel-country-code'});for(const[code,name]of [['994','Azərbaycan'],['90','Türkiyə'],['995','Gürcüstan'],['7','Rusiya'],['1','ABŞ'],['44','Böyük Britaniya'],['49','Almaniya']])select.append(el('option',{value:code,label:'+'+code},'+'+code+' · '+name));fields.countryCode=select;
  const phone=field('phone','Telefon nömrəsi','tel',{placeholder:'50 123 45 67',autocomplete:'tel-national',inputmode:'tel',maxlength:25,pattern:String.raw`[0-9 \(\)\-.]{5,25}`});phone.box.append(el('div',{class:'auth-phone-control'},select,phone.input),el('small',{class:'auth-field-help'},'SMS təsdiqi aparılmır.'));form.append(phone.box);
 }
 if(mode!=='reset')form.append(password(mode==='new-password'?'Yeni şifrə':'Şifrə'));
 if(mode==='signup'){
  const check=el('input',{type:'checkbox',id:'account-terms',name:'termsAccepted',required:true});fields.termsAccepted=check;
  const terms=link('İstifadə şərtlərini',policy.termsUrl,'auth-legal-link'),privacy=link('məxfilik bölməsini',policy.privacyUrl,'auth-legal-link');for(const a of [terms,privacy]){a.target='_blank';a.rel='noopener noreferrer';}
  form.append(el('label',{class:'auth-consent',for:'account-terms'},check,el('span',{},terms,' qəbul edirəm və ',privacy,' oxudum.')));
 }
 if(mode==='login'){form.append(link('Şifrəmi unutdum','/hesab?mode=reset','auth-forgot'));const resend=button('Təsdiq məktubunu yenidən göndər',async()=>{if(busy||!fields.email.reportValidity())return;busy=true;resend.disabled=true;error.textContent='';try{await api('/api/auth/send-verification-email',{email:fields.email.value.trim(),callbackURL:location.origin+destination});success.textContent='Təsdiq tələb olunursa, məktub göndərildi.';}catch(e){error.textContent=readableError(e);}finally{busy=false;resend.disabled=false;}});resend.className='auth-forgot';form.append(resend);}
 const submit=el('button',{type:'submit',class:'auth-submit'},mode==='signup'?'Qeydiyyatdan keç':mode==='login'?'Giriş et':mode==='reset'?'Bərpa keçidini göndər':'Şifrəni yenilə');form.append(error,success,submit);
 
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;submit.setAttribute('aria-busy','true');error.textContent='';success.textContent='';try{const values=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.type==='checkbox'?v.checked:v.value.trim()]));if(fields.password)values.password=fields.password.value;
  if(mode==='signup'){await api('/api/auth/sign-up/email',{...values,name:values.firstName+' '+values.lastName,registrationForm:true,callbackURL:location.origin+destination});success.textContent='E-poçtunuza göndərilən təsdiq keçidini açın.';fields.password.value='';}
  else if(mode==='login'){await api('/api/auth/sign-in/email',{email:values.email,password:values.password});fields.password.value='';location.assign(destination);}
  else if(mode==='reset'){await api('/api/auth/request-password-reset',{email:values.email,redirectTo:location.origin+'/hesab?mode=new-password'});success.textContent='Hesab mövcuddursa, bərpa keçidi göndərildi.';}
  else{await api('/api/auth/reset-password',{token:params.get('token'),newPassword:values.password});fields.password.value='';location.assign('/hesab');}
 }catch(e){error.textContent=readableError(e);}finally{busy=false;submit.disabled=false;submit.removeAttribute('aria-busy');}});
 panel.append(form);if(mode==='login')panel.append(divider('və ya'),google());
 const footer=el('div',{class:'auth-form-footer'},el('span',{},mode==='signup'?'Artıq hesabın var?':mode==='login'?'Hesabınız yoxdur?':'Girişə qayıt'),link(mode==='signup'?'Daxil ol →':mode==='login'?'Qeydiyyatdan keç →':'Giriş →',(mode==='login'?'/hesab?mode=signup&':'/hesab?')+'next='+encodeURIComponent(destination),'auth-switch'));panel.append(footer);
 app.replaceChildren(panel);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy)location.assign('/qrup');});
 // Only account forms scroll. Keep the focused field and existing navigation
 // above the visual viewport's keyboard without locking the long signup form.
 function visibleField(){const v=window.visualViewport;document.body.style.setProperty('--auth-keyboard-inset',Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px');const active=document.activeElement;if(!form.contains(active)||!active.matches('input,select'))return;const nav=document.querySelector('.community-bottom-nav'),reserved=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0,r=active.getBoundingClientRect(),top=(v?.offsetTop||0)+12,bottom=(v?.offsetTop||0)+(v?.height||innerHeight)-reserved-14;if(r.bottom>bottom)window.scrollBy(0,r.bottom-bottom);else if(r.top<top)window.scrollBy(0,r.top-top);}
 const resized=()=>requestAnimationFrame(visibleField);window.visualViewport?.addEventListener('resize',resized);window.addEventListener('resize',resized);form.addEventListener('focusin',resized);visibleField();
}
