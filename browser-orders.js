function capcutSamplePattern(create){
 const pattern=create('div',null,'capcut-pc-mosaic');pattern.setAttribute('aria-hidden','true');
 for(let i=0;i<144;i++)pattern.append(create('i'));
 return pattern;
}

function capcutDesktopScreen(scene,create){
 const screen=create('div',null,'capcut-pc');screen.dataset.scene=scene;
 const box=(text,cls)=>create('div',text,cls);
 const target=(text,cls)=>{const el=box(text,cls+' capcut-pc-target');el.append(create('span','➤','capcut-pc-cursor'));return el;};
 const sidebar=box(null,'capcut-pc-sidebar');
 sidebar.append(create('strong','CapCut'));
 if(scene!=='open')sidebar.append(box('Sign in','capcut-pc-sign'),box('Join Pro','capcut-pc-pro'));
 sidebar.append(box('Home'),box('Templates'),box('Video Studio'),box('Design Studio'),box('Library'));
 const workspace=box(null,'capcut-pc-workspace'),tiles=box(null,'capcut-pc-tiles');
 for(const label of ['EditPilot','AI image','Extend video','AI edit'])tiles.append(box(label));
 workspace.append(box('＋ Create project','capcut-pc-project'),tiles,box('AI-powered creative suite','capcut-pc-heading'),box(null,'capcut-pc-artwork'),box('Projects','capcut-pc-heading'));
 screen.append(sidebar,workspace);
 if(scene==='open'){
  const account=box(null,'capcut-pc-account');
  account.append(target('Sign Up','capcut-pc-sign'),box('Join Pro','capcut-pc-pro'));
  screen.append(account,box('Sxematik görünüş','capcut-pc-schematic'));return screen;
 }
 const windowFor=cls=>{
  const panel=box(null,'capcut-pc-window '+cls);
  panel.append(box('×','capcut-pc-titlebar'),create('strong','CapCut','capcut-pc-brand'));
  return panel;
 };
 const qr=windowFor('capcut-pc-qr-window');
 const content=box(null,'capcut-pc-qr-content'),sample=box(null,'capcut-pc-sample');
 sample.append(capcutSamplePattern(create),create('strong','Nümunə'));
 const steps=box(null,'capcut-pc-qr-steps');
 steps.append(box('Open the CapCut app on your phone'),box('Tap ♙ → ▣ Scan'));
 const illustration=box(null,'capcut-pc-qr-illustration');
 illustration.append(box('Ben'),box('▣ Scan'));steps.append(illustration);
 content.append(sample,steps);qr.append(content,box('Go back to sign in','capcut-pc-back'));
 screen.append(qr);
 if(scene==='choose'){
  const signin=windowFor('capcut-pc-login');
  signin.append(box('Sign in with TikTok','capcut-pc-method'),box('or','capcut-pc-or'),target('▣  Use QR code','capcut-pc-method'),box('Sign in with Facebook','capcut-pc-method'),box('Sign in with Google','capcut-pc-method'));
  screen.append(signin);
 }
 return screen;
}

function capcutScanPhone(create){
 const phone=create('div',null,'capcut-pc-phone');
 const profile=create('div',null,'capcut-pc-phone-profile');
 profile.append(create('strong','CapCut'),create('span','Ben','capcut-pc-ben'),create('span','▣ Scan','capcut-pc-scan'));
 const scanner=create('div',null,'capcut-pc-scanner');
 const frame=create('div',null,'capcut-pc-scan-frame');frame.append(capcutSamplePattern(create));
 scanner.append(create('strong','Scan'),frame);
 phone.append(profile,scanner);
 return phone;
}

function renderDeliveryMessage(pre,text){
 const deliveryGuideText='Girişdə çətinlik yaşayırsınızsa, zəhmət olmasa, Məlumat və təlimat keçidinə klikləyin.';
 const message=text.trimEnd(),start=message.length-deliveryGuideText.length;
 // Only the fixed final line is interactive. Everything entered by admin
 // remains text, never markup or a user-supplied navigation destination.
 if(!message.endsWith(deliveryGuideText)||(start>0&&message[start-1]!=='\n')){pre.textContent=text;return;}
 const caption='Məlumat və təlimat',index=start+deliveryGuideText.indexOf(caption),link=document.createElement('a');
 link.textContent=caption;link.href='#teslim-telimat';link.dataset.deliveryGuide='';link.dataset.nativeNavigation='';
 link.setAttribute('aria-haspopup','dialog');
 pre.replaceChildren(text.slice(0,index),link,text.slice(index+caption.length));
}
function chatgptScreen(animation,create){
 const scene=animation.slice('chatgpt-'.length);
 const screen=create('div',null,'chatgpt-demo');
 screen.dataset.scene=scene;
 screen.lang='tr';
 const email='numune@example.com',code='000000',exampleSecret='DEMO-ONLY-NOT-A-REAL-2FA-KEY-0000';
 const make=(text,classes)=>create('div',text,classes);
 const status=make(null,'chatgpt-demo-status');
 status.append(create('span','09:41'),create('span','▮▮▮  ◒  ▰'));
 const demo=create('span','Nümayiş','chatgpt-demo-tag');
 demo.lang='az';
 screen.append(status,demo);
 const action=(label,style='')=>make(label,'chatgpt-demo-action '+style);
 const main=make(null,'chatgpt-demo-main');
 screen.append(main);
 let delay=0;
 function field(label,value,animate=false,mark=false,paste=false){
  const row=make(null,'chatgpt-demo-field'+(mark?' chatgpt-demo-mark':''));
  row.append(create('span',label));
  if(value){
   const text=create('strong',animate?null:value);
   if(animate){
    row.classList.add('chatgpt-demo-typing');
    (paste?[value]:[...value]).forEach((char,index)=>{
     const glyph=create('span',char);
     glyph.style.setProperty('--type-at',(.15+index*.058)+'s');
     text.append(glyph);
    });
    delay=paste ? .85 : .42+value.length*.058;
    row.style.setProperty('--phase',delay+'s');
   }
   row.append(text);
  }
  return row;
 }
 if(scene==='authenticator'||scene==='code'){
  const result=scene==='code';
  screen.classList.add('chatgpt-demo-twofa');screen.lang='en';
  const bar=make(null,'chatgpt-twofa-bar');
  bar.append(create('b','2Fa.Live'),create('small','Authenticator'));
  const secret=field('2FA Secret',exampleSecret,!result,false,true);
  secret.classList.add('chatgpt-twofa-secret');
  const submit=action('Submit',result?'':'chatgpt-demo-after');
  if(!result)submit.style.setProperty('--phase',delay+'s');
  const output=field('2FA Code','');
  const value=make(null,'chatgpt-twofa-output');
  if(result){
   value.append(create('span',exampleSecret+' | '),create('strong',code,'chatgpt-twofa-digits chatgpt-demo-mark'));
  }else value.append(create('span','ABC|2FA Code'));
  output.append(value);
  main.append(bar,secret,submit,output,action('Copy'));
  return screen;
 }
 if(scene==='open'){
  main.classList.add('chatgpt-demo-welcome');
  main.append(create('h3','ChatGPT'),action('Apple ile Devam Et','chatgpt-demo-primary'),action('Google ile devam et'),action('Oturum aç veya kaydol','chatgpt-demo-mark'));
  return screen;
 }
 const codeScene=scene==='verification'||scene==='return';
 const title=codeScene?'Kimlik doğrulama uygulamanı kontrol et':scene==='password'?'Parolanı gir':'Oturum aç veya kaydol';
 main.append(make('ChatGPT','chatgpt-demo-brand'),create('h3',title));
 if(codeScene)main.append(create('p','Kimlik doğrulama uygulamasından aldığın 6 haneli kodu gir.'));
 if(scene==='email')main.append(create('p','ChatGPT hesabına e-posta ile giriş yap.'));
 if(scene==='password')main.append(field('E-posta',email));
 if(scene==='email')main.append(field('E-posta',email,true));
 else if(scene==='password')main.append(field('Parola','••••••••',true));
 else main.append(field('Kod',scene==='return'?code:'',scene==='return',scene==='verification',scene==='return'));
 const next=action('Devam',scene==='verification'?'chatgpt-demo-disabled':'chatgpt-demo-primary chatgpt-demo-after');
 if(delay)next.style.setProperty('--phase',delay+'s');
 main.append(next);
 if(scene==='password')main.append(make('Parolanı mı unuttun?','chatgpt-demo-hint'));
 if(!codeScene)main.append(make('VEYA','chatgpt-demo-divider'),action('Google ile devam et'),action('Apple ile Devam Et'));
 return screen;
}
function primeScreen(animation,create){
 const screen=create('div',null,'prime-demo');screen.dataset.scene=animation;screen.lang='tr';
 const make=(text,cls)=>create('div',text,cls), sample='numune@example.com';
 const head=make('prime video','prime-demo-brand'),main=make(null,'prime-demo-content');
 const action=(text,target=false,later=false)=>make(text,'prime-demo-button'+(target?' prime-demo-target':'')+(later?' prime-demo-later':''));
 function field(label,value){
  const box=make(null,'prime-demo-field'),typed=create('span',null,'prime-demo-typing');
  [...value].forEach((char,i)=>{const glyph=create('span',char);glyph.style.setProperty('--delay',(0.25+i*.075)+'s');typed.append(glyph);});
  box.append(typed);main.append(create('strong',label,'prime-demo-label'),box);
 }
 if(animation==='prime-email'){
  const choice=(name,hint,on)=>{const row=make(null,'prime-demo-choice'+(on?' prime-demo-choice-active':'')),caption=create('span');caption.append(create('strong',name),document.createTextNode(' '+hint));row.append(create('i'),caption);return row;};
  main.append(create('h3','Hoş Geldiniz'),choice('Hesap oluşturun','Amazon hesabınız yok mu?',false),choice('Giriş yapın','Zaten müşteri misiniz?',true));
  field('Cep telefonu numarası veya e-posta girin',sample);
  main.append(action('Devam Et',true,true),make('Yardıma mı ihtiyacınız var?','prime-demo-link'));
 }else if(animation==='prime-password'){
  const identity=make(null,'prime-demo-identity');identity.append(create('span',sample),create('span','Değiştir','prime-demo-link'));
  const options=make(null,'prime-demo-options');options.append(create('span','□ Şifreyi göster'),create('span','Şifremi unuttum.','prime-demo-link'));
  main.append(create('h3','Giriş yap'),identity);
  field('Amazon şifresi','••••••••');
  main.append(options,action('Giriş yap',true,true));
 }else{
  main.append(create('h3','Bir dahaki sefere parolayı atlayın'),
   create('p','Parola kullanmaktan daha güvenli bir giriş yolu için bir geçiş anahtarı oluşturun. Telefonunuzun kilidini açmak için kullandığınız Face ID’yi, parmak izinizi veya PIN kodunu kullanın.'),
   create('p','Yüzünüzü, parmak izinizi veya PIN kodu verilerinizi saklamayız.'),
   action('Bir geçiş anahtarı ayarlayın'),action('Hayır, parola kullanmaya devam et',true));
  main.lastElementChild.classList.add('prime-demo-secondary');
 }
 screen.append(head,main);return screen;
}

function spotifyScreen(animation,create){
 const screen=create('div',null,'spotify-demo');screen.dataset.scene=animation;screen.lang='tr';
 const box=(text,cls)=>create('div',text,cls);
 const pill=(text,cls='')=>box(text,'spotify-pill '+cls);
 const mark=(node,delayed=false)=>{
  node.classList.add('netflix-target');
  if(delayed)node.classList.add('netflix-target-later');
  return node;
 };
 const type=text=>{
  const node=create('span',null,'netflix-typing');
  for(const [i,char] of [...text].entries()){
   const glyph=create('span',char);glyph.style.setProperty('--delay',(0.12+i*.09)+'s');node.append(glyph);
  }
  return node;
 };
 const logo=()=>{
  const mark=create('span',null,'spotify-logo');
  mark.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="white"/><path d="M6 12q10-4 20 2M7 17q9-3 17 2M8 22q8-2 14 2" fill="none" stroke="#121212" stroke-width="2.5" stroke-linecap="round"/></svg>';
  return mark;
 };
 const status=box(null,'spotify-status');status.append(create('span','01:40'),create('span','▴ ▰ ▱'));screen.append(status);
 if(animation==='spotify-open'){
  const hero=box(null,'spotify-hero');hero.append(logo(),create('strong',"Milyonlarca şarkı. Spotify’da ücretsiz."));
  const actions=box(null,'spotify-welcome-actions');
  actions.append(pill('Ücretsiz kaydol','spotify-green'),mark(pill('Oturum aç','spotify-outline')));
  screen.append(hero,actions);return screen;
 }
 if(animation==='spotify-premium'){
  const drawer=box(null,'spotify-drawer'),profile=box(null,'spotify-profile');
  const name=box(null,'spotify-profile-name');name.append(create('strong','Örnek Hesap'),create('small','Profili görüntüle'));
  profile.append(box('Ö','spotify-avatar'),name,create('span','⌃'));
  const accounts=box(null,'spotify-accounts');
  for(const [initial,label] of [['M','Müzik hesabı'],['D','Demo hesap'],['+','Hesap ekle']]){
   const account=box(null,'spotify-account');account.append(box(initial,'spotify-avatar'),create('span',label));accounts.append(account);
  }
  const card=box(null,'spotify-profile-card');card.append(profile,accounts);drawer.append(card);
  const premium=box(null,'spotify-menu-row spotify-premium');
  premium.append(logo(),create('span','Premium üyeliğin'),mark(create('strong','Bireysel','spotify-badge')));drawer.append(premium);
  for(const [icon,text] of [['↗','Dinleme istatistikleri · Yeni'],['◷','Son çalınanlar'],['♧','Güncellemelerin'],['⚙','Ayarlar ve gizlilik']]){
   const row=box(null,'spotify-menu-row');row.append(create('span',icon,'spotify-menu-icon'),create('span',text));drawer.append(row);
  }
  const activity=box(null,'spotify-activity');
  for(const [initial,label] of [['Ö','Aktivite'],['+','Arkadaşlarını davet et']]){
   const action=box(null,'spotify-account');action.append(box(initial,'spotify-avatar'),create('span',label));activity.append(action);
  }
  const messages=box(null,'spotify-messages');
  messages.append(create('strong','Mesajlar ›'),create('small',"Sevdiğin içerikleri Spotify’da arkadaşlarınla paylaş."));
  const compose=box(null,'spotify-new-message');compose.append(box('✎','spotify-avatar'),create('span','Yeni mesaj'));
  drawer.append(activity,messages,compose);
  screen.append(drawer,box('Örnek hesap olarak oturum açtın','spotify-toast'));return screen;
 }
 const header=box(null,'spotify-header');
 header.append(box('‹','spotify-back'),create('strong',animation==='spotify-code'?'':'Oturum aç'));screen.append(header);
 const main=box(null,'spotify-main');
 if(animation==='spotify-code'){
  main.append(create('h3','E-posta adresine gönderdiğimiz kodu gir'),
   create('p','h****@example.com adresine gönderildi. İstenmeyen posta klasörünü kontrol etmen gerekebilir. E-posta uygulamasını aç.'));
  const code=box(null,'spotify-codes');
  for(let i=0;i<6;i++)code.append(box(null,'spotify-code-box'));
  main.append(code,pill('Oturum aç','spotify-green spotify-unavailable'),box('⟳  Kodu yeniden gönder','spotify-option'),mark(box('Parola ile oturum aç','spotify-option')));
  const keys=box(null,'spotify-keyboard spotify-numeric');
  const numbers=['1','2','3','4','5','6','7','8','9','','0','⌫'];
  const letters=['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
  for(const [index,n] of numbers.entries()){
   const key=box(n,n?'spotify-key':'');
   if(letters[index])key.append(create('small',letters[index]));
   keys.append(key);
  }
  screen.append(main,keys);return screen;
 }
 const email=animation==='spotify-email',field=box(null,'spotify-field');
 field.append(type(email?'hesab@example.com':'••••••••'));
 if(!email)field.append(create('span','◉','spotify-eye'));
 main.append(create('strong',email?'E-posta':'Parola','spotify-label'),field,mark(pill(email?'Devam et':'Oturum aç','spotify-green'),true));
 screen.append(main);
 if(email){
  main.append(box('Sosyal medya hesabınla oturum aç','spotify-social-title'));
  for(const [icon,text] of [['G','Google'],['f','Facebook'],['●','Apple']]){
   const social=pill(text+' ile devam et','spotify-outline');social.prepend(create('span',icon,'spotify-social-icon'));main.append(social);
  }
  const signup=box(null,'spotify-signup');signup.append(create('span','Bir hesabın yok mu?'),create('strong','Kaydol'));screen.append(signup);
 }else{
  const keys=box(null,'spotify-keyboard spotify-symbols');
  keys.append(box('spotify.com parolası · hesab@example.com','spotify-keyboard-label'));
  for(const char of '1234567890-/:;()₺&@"')keys.append(box(char,'spotify-key'));
  const symbols=box(null,'spotify-symbol-row');
  for(const key of ['#+=','. ',',','?','!','’','⌫'])symbols.append(box(key,'spotify-key'));
  keys.append(symbols,box('ABC','spotify-key spotify-key-mode'),box('boşluk','spotify-key spotify-space'),box('✓','spotify-key spotify-enter'),box('◎','spotify-globe'));
  screen.append(keys);
 }
 return screen;
}

function netflixScreen(animation,create){
 const screen=create('div',null,'netflix-demo');screen.dataset.scene=animation;
 const icon=path=>{const n=create('span',null,'netflix-icon');n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';return n;};
 const brand=create('strong','NETFLIX','netflix-brand'),head=create('div',null,'netflix-top');
 if(animation!=='netflix-open')head.append(icon('m14 5-7 7 7 7'));
 head.append(brand);screen.append(head);
 const box=(text,cls='')=>create('div',text,'netflix-box '+cls);
 const target=(node,delayed=false)=>{node.classList.add('netflix-target');if(delayed)node.classList.add('netflix-target-later');return node;};
 const typing=(text)=>{const n=create('span',null,'netflix-typing');[...text].forEach((letter,i)=>{const char=create('span',letter);char.style.setProperty('--delay',(0.12+i*0.09)+'s');n.append(char);});return n;};
 const help=()=>{const h=create('div','Get Help','netflix-help');h.append(icon(animation==='netflix-help'?'m6 15 6-6 6 6':'m6 9 6 6 6-6'));return h;};
 if(animation==='netflix-open'){
  const sign=target(box('Sign In','netflix-top-sign'));head.append(sign);
  const posters=create('div',null,'netflix-posters');
  for(const [title,style] of [['THRILLER','red'],['STORIES','blue'],['DRAMA','gold'],['ADVENTURE','green'],['MYSTERY','purple'],['CINEMA','red']]){
   const poster=create('div',null,'netflix-poster '+style);
   poster.append(icon('M4 21V8l8-5 8 5v13M8 21v-6h8v6M9 8h6'),create('strong',title));posters.append(poster);
  }
  const hero=create('div',null,'netflix-hero');hero.append(posters,create('h3','Films, series and more. Just a few taps away.'));
  screen.append(hero,create('div','●  ○','netflix-carousel'),box('Create your Netflix account and discover more.','netflix-promo'));return screen;
 }
 const main=create('div',null,'netflix-main');
 const heading=animation==='netflix-email'?'Enter your info to sign in':animation==='netflix-password'?'Enter your password':'Enter the code we sent to your email';
 main.append(create('h3',heading));
 if(animation==='netflix-email'){
  const email=box(null,'netflix-entry netflix-entry-typing');email.classList.add('netflix-writing');email.append(create('small','Email or mobile number'),typing('hesab@example.com'));
  main.append(email,target(box('Continue','netflix-red'),true),help(),create('small',"This page is protected by Google reCAPTCHA to ensure you’re not a bot.",'netflix-muted'));
 }else{
  const email=box(null,'netflix-account');email.append(create('span','hesab@example.com'),create('span','Change'));main.append(email);
  if(animation==='netflix-password'){
   const password=box(null,'netflix-entry netflix-entry-typing');password.classList.add('netflix-writing');password.append(create('small','Password'),typing('********'),icon('M7 10h10v10H7zM9 10V7a3 3 0 0 1 6 0v3'));
   main.append(password,target(box('Sign In','netflix-red'),true),create('div','or','netflix-or'),box('Use Sign-in Code','netflix-code-button'),help(),create('small',"This page is protected by Google reCAPTCHA to ensure you’re not a bot.",'netflix-muted'));
  }else{
   const codes=create('div',null,'netflix-codes');for(let i=0;i<4;i++)codes.append(box(''));
   main.append(codes,create('p','This code will expire in 15 minutes.','netflix-muted'),create('p',"Didn’t get a code? Resend code.",'netflix-muted'));
   const h=help();main.append(animation==='netflix-code'?target(h):h);
   if(animation==='netflix-help'){
    const menu=create('div',null,'netflix-help-menu');
    menu.append(create('div',"I can’t access this email right now"),target(create('div','Use password instead')),create('div','Learn more about sign-in'));main.append(menu);
   }
  }
 }
 screen.append(main);return screen;
}
(()=>{'use strict';window.mountBrowserOrders=(options={})=>{const root=document.getElementById('browserOrders');if(!root)return;const life=new AbortController(),on=(t,n,f)=>t.addEventListener(n,f,{signal:life.signal});
 const error=document.getElementById('browserOrdersError'),more=document.getElementById('browserOrdersMore'),dialog=document.getElementById('browserReceipt'),content=document.getElementById('browserReceiptContent');
 let cursor=null,loading=false,loaded=false,generation=0,timer,focused=false,pageFingerprint=null,hasAppended=false,initialRequest=options.initialRequest,autoOrder=null;const seen=new Set(),requests=new Set(),prior=new Map();
 if(options.ui?.pageData)options.initial=options.ui.pageData;
 const target=new URLSearchParams(location.search).get('order');
 const ui=options.ui||{},credentials=ui.credentials??=new Map(),expandedOrders=ui.expanded??=new Set();
 const orderMarkup=new WeakMap();
 let accountId=options.initial?.accountId||null;autoOrder=ui.autoOrder??null;
 const sounds=import('/checkout-sounds.js?v=1').catch(()=>null);
 const repeatDialog=document.createElement('dialog');repeatDialog.className='browser-order-repeat';
 const guideDialog=document.createElement('dialog'),guideItems=new WeakMap();
 guideDialog.className='browser-order-guide';guideDialog.setAttribute('aria-labelledby','browserOrderGuideTitle');
 let guideTurn=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clear(){completedVisibility?.disconnect();generation++;guideTurn++;for(const c of requests)c.abort();requests.clear();cursor=null;loading=false;loaded=false;hasAppended=false;pageFingerprint=null;seen.clear();prior.clear();autoOrder=null;focused=false;if(guideDialog.open)guideDialog.close();guideDialog.remove();root.replaceChildren();content.replaceChildren();if(dialog.open)dialog.close();if(repeatDialog.open)repeatDialog.close();repeatDialog.remove();more.hidden=true;error.hidden=true;root.setAttribute('aria-busy','false');}
 function gate(){credentials.clear();expandedOrders.clear();ui.pageData=null;clear();options.onData?.(null);root.classList.remove('browser-orders-list');root.innerHTML='<div class="browser-orders-message"><h2>Sifarişlərinizi görmək üçün hesabınıza daxil olun.</h2><p>Hesabınız yoxdur? Qeydiyyatdan keçin.</p><div class="orders-login-actions"><a class="orders-action" href="/owner-login?next=%2Fsifarislerim">Daxil ol</a> <a class="orders-action" href="/hesab?mode=signup&amp;next=%2Fsifarislerim">Qeydiyyatdan keç</a></div></div>';}
 async function api(path){if(options.api)return options.api(path);const c=new AbortController(),t=setTimeout(()=>c.abort(),options.profile?12000:20000);requests.add(c);try{const r=await fetch('/api/payments/'+path,{cache:'no-store',credentials:'same-origin',signal:c.signal,headers:{Accept:'application/json'}});if(r.status===401&&!life.signal.aborted)options.onUnauthorized?.();const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Server cavab vermədi.'),{status:r.status});return d;}finally{clearTimeout(t);requests.delete(c);}}
 const money=v=>Number.isFinite(Number(v))?Number(v).toFixed(2).replace('.',',')+' ₼':'—';
 const date=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Baku'}).format(d).replaceAll('/','.').replace(',',''):'Tarix məlum deyil';};
 const statuses={reviewing:'Yoxlanılır',pending:'Yoxlanılır',submitted:'Yoxlanılır',new_receipt_requested:'Yeni çek tələb olunur',preparing:'Hazırlanır',approved:'Hazırlanır',completed:'Tamamlandı',cancelled:'Ləğv edildi',rejected:'Rədd edildi',expired:'Müddəti bitdi'};
 const photo=url=>{let src='';try{const u=new URL(url||'',location.origin);if(url&&['http:','https:'].includes(u.protocol))src=u.href;}catch{}return '<span class="browser-order-image"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9"/></svg>'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'')+'</span>';};
 const completedIcon='<svg class="order-completed-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><rect width="20" height="20" rx="5" fill="#139A65"/><rect class="order-completed-glow" width="20" height="20" rx="5" fill="#51E4A0"/><path class="order-completed-tick" d="m5 10 3.2 3.2L15 6.5" pathLength="1" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path class="order-completed-shine" d="M-9 0h2l-7 20h-2Z" fill="#FFE3A0"/></svg>';
 // Only animate visible badges. Long histories must not repaint off-screen SVGs.
 const completedVisibility=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.classList.toggle('is-animating',entry.isIntersecting);
 }):null;
 life.signal.addEventListener('abort',()=>completedVisibility?.disconnect(),{once:true});
 const icons={preparing:'⏳',approved:'⏳',rejected:'❌'};
 const lineIcon=path=>'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
 const docIcon=lineIcon('M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6');
 const copyIcon=lineIcon('M8 8h12v12H8z M16 8V4H4v12h4');
 const repeatIcon=lineIcon('M3 12a9 9 0 1 1 2.6 6.4 M3 4v8h8');
 const clockIcon=lineIcon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2');
 const bakuCalendar=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'});
 function expiryBar(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const end=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(+end)||end.toISOString().slice(0,10)!==value)return '';
  const parts=Object.fromEntries(bakuCalendar.formatToParts(new Date()).map(x=>[x.type,x.value]));
  const days=(+end-Date.UTC(+parts.year,+parts.month-1,+parts.day))/86400000;
  const label=days<=0?'Paketin müddəti bitib':days>=28&&days<=31?'Bu paketin müddəti təxminən 1 ay sonra bitir':'Bu paketin müddəti '+days+' gün sonra bitir';
  return '<div class="browser-order-expiry"'+(days<=0?' data-expired':'')+'>'+clockIcon+'<span>'+label+'</span><time datetime="'+value+'">'+value.split('-').reverse().join('.')+' · Bakı vaxtı</time></div>';
 }
 const repeats=new WeakMap();
 function orderItems(o){return o.items?.length?o.items:[{title:o.product,planName:o.plan,quantity:o.quantity||1,unitCents:o.amount==null?null:Math.round(Number(o.amount)*100)/(o.quantity||1),image:o.image,warranty:o.warranty,durationMonths:o.durationMonths,repeat:o.repeat,expiresOn:o.expiresOn}];}
 function card(o,items){
  const rows=items.map((x,i)=>{
   const qty=Number(x.quantity),unit=x.unitCents==null?null:Number(x.unitCents)/100;
   const duration=Number(x.durationMonths);
   const extraDuration=Number.isInteger(duration)&&duration>0&&!new RegExp('(?:^|\\D)'+duration+'\\s*ay','iu').test(x.planName||'')?' · '+duration+' ay':'';
   const delivered=(['preparing','completed'].includes(o.status)?o.deliveries||[]:[]).filter(d=>d.line===i).map(d=>'<article class="browser-order-delivery" data-delivery="'+esc(d.id)+'"><header><span>'+esc(x.title)+' · '+esc(x.planName)+(d.quantity>1?' · '+esc(d.quantity)+' ədəd':'')+'</span><button type="button" data-copy-delivery disabled>'+copyIcon+'Kopyala</button></header><div class="browser-delivery-credentials"></div><pre hidden></pre><span role="status" data-delivery-status></span></article>').join('');
   const cancelled=o.cancellation?.lines?.find(line=>line.index===i)?.quantity||0;
   return '<section class="browser-order-line"><div class="browser-order-line-main"><div class="browser-order-item-info"><h2>'+esc(x.title)+'</h2><div class="browser-order-line-meta"><span>'+esc(x.planName)+esc(extraDuration)+'</span>'+(x.warranty?'<small class="browser-order-warranty">'+esc(x.warranty)+'</small>':'')+'<strong class="browser-order-unit">'+esc(qty)+' × '+(unit==null?'—':esc(money(unit)))+'</strong></div></div><div class="browser-order-line-buttons"><button type="button" data-order-info="'+i+'" aria-haspopup="dialog" aria-expanded="false" class="order-guide-button">'+docIcon+'<span>Təlimat</span></button><button type="button" data-buy-again="'+i+'">'+repeatIcon+'Yenidən al</button></div></div>'+(cancelled?'<p>'+esc(cancelled)+' ədəd ləğv edildi.</p>':'')+(delivered?expiryBar(x.expiresOn):'')+'<div class="browser-order-instructions" hidden>'+(delivered?'<h3>Alınmış hesablar</h3>'+delivered:'<p>'+(cancelled?'Bu məhsulun təhvil verilməyən hissəsi ləğv edildi.':o.status==='completed'?'Status: Tamamlandı. Bu məhsul üçün ayrıca təhvil məlumatı yoxdur.':'Status: '+esc(statuses[o.status]||'Status məlum deyil')+'. Təhvil məlumatı hazır deyil.')+'</p>')+'<span role="status" data-line-feedback></span></div></section>';
  }).join('');
  const total=o.amount==null?'—':esc(money(o.amount));
  return '<details class="browser-order" data-order-id="'+esc(o.id)+'" data-order-code="'+esc(o.orderCode)+'"><summary class="browser-order-header">'+photo(items[0]?.image)+'<div class="browser-order-heading"><div class="browser-order-meta"><span class="browser-order-status" data-status="'+esc(o.status)+'">'+(o.status==='completed'?completedIcon:icons[o.status]?'<span aria-hidden="true">'+icons[o.status]+'</span> ':'')+esc(statuses[o.status]||'Status məlum deyil')+'</span><span class="browser-order-code">№ '+esc(o.orderCode)+'</span><time>'+esc(date(o.createdAt))+'</time></div><strong>'+esc(o.product)+'</strong></div><strong class="browser-order-price">'+total+'</strong><svg class="browser-order-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="browser-order-items">'+rows+(o.cancellation?'<p class="browser-order-cancellation">'+esc(o.statusMessage)+'</p>'+(o.cancellation.reason?'<p class="browser-order-cancellation" style="white-space:pre-wrap">Səbəb — '+esc(o.cancellation.reason)+'</p>':''):'')+'</div><div class="browser-order-actions browser-order-footer"><div class="browser-order-total"><span>Cəmi</span><strong class="browser-order-price">'+total+'</strong></div>'+(o.receiptAvailable?'<button type="button" data-receipt="'+esc(o.id)+'">Qəbzə bax</button>':'')+'</div></details>';
 }
 function topup(t){const status={reviewing:'Yoxlanılır',approved:'Təsdiqləndi',rejected:'Rədd edildi'}[t.status];if(!status)return '';return '<article class="browser-order browser-order-topup" data-topup-id="'+esc(t.id)+'"><header class="browser-order-header"><div><span class="browser-order-code">Balans artırma</span><time>'+esc(date(t.created_at))+'</time></div><span class="browser-order-status" data-status="'+esc(t.status)+'">'+status+'</span><strong class="browser-order-price">'+esc(money(Number(t.approved_cents??t.requested_cents)/100))+'</strong></header></article>';}
 root.addEventListener('error',e=>{if(e.target.matches?.('.browser-order-image img'))e.target.hidden=true;},{capture:true,signal:life.signal});
 const latestCompleted=d=>d.orders.find(order=>order.status==='completed')?.id??null;
 function paint(d,append=false,{live=false}={}){
  hasAppended=append||d.retainedPages===true;
  if(!append)pageFingerprint=JSON.stringify([d.orders,d.topups]);
  const expanded=new Set([...expandedOrders,...[...root.querySelectorAll('[data-order-id][open]')].map(x=>x.dataset.orderId)]);
  if(!target&&(!append||!autoOrder)){
   const newest=latestCompleted(d);
   if(newest!==autoOrder){
    if(newest)expanded.add(newest);
    autoOrder=newest;ui.autoOrder=newest;
   }
  }
  if(!append){
   const ids=new Set(d.orders.map(o=>o.id));
   for(const node of [...root.children])if(!node.dataset.orderId||!ids.has(node.dataset.orderId)){
    for(const icon of node.querySelectorAll('.order-completed-icon,.order-guide-button'))completedVisibility?.unobserve(icon);
    node.remove();
   }
   seen.clear();
   for(const t of d.topups||[])root.insertAdjacentHTML('beforeend',topup(t));
  }
  for(const [id,data] of Object.entries(d.deliveryDetails||{}))if(typeof data?.text==='string')credentials.set(id,data);
  const ordered=[];
  for(const o of d.orders){
   if(seen.has(o.id))continue;seen.add(o.id);const items=orderItems(o),markup=card(o,items);
   let node=[...root.children].find(n=>n.dataset.orderId===o.id);
   if(!node||orderMarkup.get(node)!==markup){
    const template=document.createElement('template');template.innerHTML=markup;
    const next=template.content.firstElementChild;
    if(node){for(const icon of node.querySelectorAll('.order-completed-icon,.order-guide-button'))completedVisibility?.unobserve(icon);node.replaceWith(next);}else root.append(next);
    node=next;orderMarkup.set(node,markup);
    for(const icon of node.querySelectorAll('.order-completed-icon,.order-guide-button'))completedVisibility?.observe(icon);
   }
   ordered.push(node);
   repeats.set(node,items.map(x=>x.repeat));guideItems.set(node,items);
   if(expanded.has(o.id)||(!focused&&target===String(o.orderCode)))node.open=true;
   if(!focused&&target===String(o.orderCode)){
    focused=true;node.scrollIntoView({block:'nearest'});
   }
   if(node.open)showAccounts(node);
   if(live&&['reviewing','submitted','pending','new_receipt_requested'].includes(prior.get(o.id))&&['preparing','completed'].includes(o.status))void sounds.then(m=>m?.playCheckoutSound('order',o.orderCode));
   prior.set(o.id,o.status);
  }
  if(!append)for(let i=0;i<ordered.length;i++)if(root.children[i]!==ordered[i])root.insertBefore(ordered[i],root.children[i]||null);
  ui.pageData=append?{...ui.pageData,orders:[...(ui.pageData?.orders||[]),...d.orders],nextCursor:d.nextCursor,retainedPages:true}:d;
  loaded=true;root.classList.add('browser-orders-list');if(!seen.size&&!root.querySelector('[data-topup-id]'))root.innerHTML='<div class="browser-orders-message"><h2>Hələ sifarişiniz yoxdur</h2><p>Hesabınıza bağlı sifarişlər burada görünəcək.</p><a class="orders-action" href="/mehsul">Məhsullara bax</a></div>';cursor=d.nextCursor;more.hidden=!cursor;window.dispatchEvent(new CustomEvent('mirpanel:orders-loaded',{detail:{empty:!seen.size&&!root.querySelector('[data-topup-id]')}}));options.onData?.(ui.pageData);
 }
 async function load(append=false,live=false){if(loading)return;const run=generation;loading=true;root.setAttribute('aria-busy','true');more.disabled=true;error.hidden=true;
  try{const started=!append?initialRequest:null;if(started)initialRequest=null;const d=await(started||api('my-orders'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):target?'?order='+encodeURIComponent(target):'')));if(run!==generation||life.signal.aborted)return;options.validate?.(d);
   if(accountId&&d.accountId&&accountId!==d.accountId){gate();return;}
   if(d.accountId)accountId=d.accountId;
   if(live&&(dialog.open||guideDialog.open||repeatDialog.open))return;
   if(!root.closest('.account-panel')){if(window.MirpanelNavigation)void window.MirpanelNavigation.go('/profil?tab=orders');else location.replace('/profil?tab=orders');return;}
   if(live&&hasAppended&&(target||!latestCompleted(d)||latestCompleted(d)===autoOrder)){
    for(const [id,data] of Object.entries(d.deliveryDetails||{}))if(typeof data?.text==='string')credentials.set(id,data);
    ui.pageData.deliveryDetails={...ui.pageData.deliveryDetails,...d.deliveryDetails};
    root.querySelectorAll('[data-order-id][open]').forEach(showAccounts);
    return;
   }
   if(append||!loaded||JSON.stringify([d.orders,d.topups])!==pageFingerprint)paint(d,append,{live});
   else{
    for(const [id,data] of Object.entries(d.deliveryDetails||{}))if(typeof data?.text==='string')credentials.set(id,data);
    root.querySelectorAll('[data-order-id][open]').forEach(showAccounts);
    ui.pageData={...ui.pageData,deliveryDetails:d.deliveryDetails};
    options.onData?.(d);
   }
   if(live)for(const box of root.querySelectorAll('[data-order-id][open] [data-delivery]')){
    if(credentials.has(box.dataset.delivery)&&!d.deliveryDetails?.[box.dataset.delivery])void loadDelivery(box,true);
   }
  }catch(e){if(run!==generation)return;if(e.status===401||e.status===403){if(e.status===401&&options.onUnauthorized)options.onUnauthorized();else gate();return;}error.replaceChildren(document.createTextNode('Sifarişləri yükləmək mümkün olmadı. '));error.hidden=false;if(!loaded)root.innerHTML='<div class="browser-orders-message"><button type="button" data-retry>Yenidən cəhd et</button></div>';else{const retry=document.createElement('button');retry.type='button';retry.textContent='Yenidən cəhd et';on(retry,'click',()=>load(append));error.append(retry);}
  }finally{if(run===generation){loading=false;more.disabled=false;root.setAttribute('aria-busy','false');}}
 }
 on(more,'click',()=>load(!!cursor));
 const deliveryData=new WeakMap(),deliveryLoads=new WeakMap(),copyTimers=new WeakMap();
 function showAccounts(order){
  if(document.hidden)return;
  for(const panel of order.querySelectorAll('.browser-order-instructions')){
   const boxes=panel.querySelectorAll('[data-delivery]');if(!boxes.length)continue;
   panel.hidden=false;panel.closest('.browser-order-line').querySelector('[data-order-info]').setAttribute('aria-expanded','true');
   for(const box of boxes){
    const saved=credentials.get(box.dataset.delivery);
    if(saved&&deliveryData.get(box)?.d!==saved)renderDelivery(box,saved);
    else if(!saved)void loadDelivery(box);
   }
  }
 }
 root.addEventListener('toggle',e=>{
  if(!e.target.matches?.('[data-order-id]'))return;
  if(e.target.open){expandedOrders.add(e.target.dataset.orderId);showAccounts(e.target);}
  else expandedOrders.delete(e.target.dataset.orderId);
 },{capture:true,signal:life.signal});
 function renderDelivery(box,d){
  const status=box.querySelector('[data-delivery-status]');
  if(JSON.stringify(deliveryData.get(box)?.d)===JSON.stringify(d)){status.replaceChildren();return;}
  const rows=[['email','E-poçt'],['password','Şifrə']].filter(([key])=>typeof d[key]==='string'&&d[key]);
   box.querySelector('.browser-delivery-credentials').innerHTML=rows.map(([key,label])=>'<div><span>'+label+'</span><strong>'+esc(d[key])+'</strong><button type="button" data-copy-delivery-field="'+key+'" aria-label="'+label+' kopyala">'+copyIcon+'</button></div>').join('');
   if(d.netflixRoom){
    const room=document.createElement('div');room.className='browser-netflix-room';
    for(const [label,value] of [['Otaq adı',d.netflixRoom.name],['Otaq kodu',d.netflixRoom.code]]){
     const cell=document.createElement('div'),title=document.createElement('span'),text=document.createElement('strong');
     title.textContent=label;text.textContent=value;cell.append(title,text);room.append(cell);
    }
    box.querySelector('.browser-delivery-credentials').append(room);
   }
   const pre=box.querySelector('pre');renderDeliveryMessage(pre,d.text);pre.hidden=false;
   deliveryData.set(box,{d,rows});box.querySelector('[data-copy-delivery]').disabled=false;status.replaceChildren();box.classList.remove('browser-delivery-pending');box.removeAttribute('aria-busy');
 }
 async function loadDelivery(box,refresh=false){
  if(deliveryLoads.has(box)||!refresh&&deliveryData.has(box))return;
  const token={},status=box.querySelector('[data-delivery-status]'),run=generation;
  deliveryLoads.set(box,token);
  if(!deliveryData.has(box)){
   box.classList.add('browser-delivery-pending');box.setAttribute('aria-busy','true');
   status.innerHTML='<span class="browser-delivery-skeleton" aria-hidden="true"><span></span><span></span><span></span></span>';
  }
  const valid=()=>run===generation&&!life.signal.aborted&&deliveryLoads.get(box)===token&&box.isConnected;
  try{
   const d=await api('my-orders/codes/'+encodeURIComponent(box.dataset.delivery));
   if(!valid())return;
   if(typeof d.text!=='string')throw Error();
   credentials.set(box.dataset.delivery,d);
   if(ui.pageData)(ui.pageData.deliveryDetails??={})[box.dataset.delivery]=d;
   renderDelivery(box,d);
  }catch(e){
   if(valid()&&(e.status===401||e.status===403)){gate();return;}
   if(valid()){box.classList.remove('browser-delivery-pending');box.removeAttribute('aria-busy');status.innerHTML='Təhvil məlumatı alınmadı. <button type="button" data-retry-delivery>Yenidən cəhd et</button>';}
  }finally{if(deliveryLoads.get(box)===token)deliveryLoads.delete(box);}
 }
 async function copyDelivery(button){
  const box=button.closest('[data-delivery]'),data=deliveryData.get(box);if(!data)return;
  const {d,rows}=data,field=button.dataset.copyDeliveryField,status=box.querySelector('[data-delivery-status]');
  const text=field?d[field]:[...rows.map(([key,label])=>label+': '+d[key]),...(rows.length?['']:[]),d.text].join('\n');
  try{
   if(navigator.clipboard?.write&&typeof ClipboardItem==='function')await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'})})]);
   else await navigator.clipboard.writeText(text);
   if(deliveryData.get(box)!==data)return;
   status.textContent='Kopyalandı';clearTimeout(copyTimers.get(box));copyTimers.set(box,setTimeout(()=>{status.textContent='';},1800));
  }catch{if(deliveryData.get(box)===data)status.textContent='Kopyalamaq mümkün olmadı.';}
 }
 function renderInformation(text){
  const content=document.createElement('div');
  content.className='browser-guide-information';
  let block=null;
  for(const raw of text.split(/\r?\n/)){
   const line=raw.trim();
   if(!line){block=null;continue;}
   const heading=line.match(/^#{1,6}\s+(.+)$/);
   if(heading){
    const title=document.createElement('h3');title.textContent=heading[1];content.append(title);block=null;continue;
   }
   const bullet=line.match(/^([-*•]|\d+[.)])\s+(.+)$/);
   const tag=bullet?(/^\d/.test(bullet[1])?'ol':'ul'):'p';
   if(block?.localName!==tag){
    block=document.createElement(tag);
    if(tag==='p')block.className='browser-guide-text';
    if(tag==='ol')block.start=parseInt(bullet[1],10);
    content.append(block);
   }
   if(bullet){
    const item=document.createElement('li');item.textContent=bullet[2];block.append(item);
   }else block.append((block.textContent?'\n':'')+line);
  }
  return content;
 }
 function netflixTvScreen(mode,create){
  const node=(text,cls)=>create('div',text,cls),sample='hesab@example.com';
  const scene=node(null,'netflix-tv-scene');scene.dataset.scene=mode;scene.lang='en';scene.setAttribute('inert','');
  const key=(text,cls='')=>create('span',text,'netflix-tv-key '+cls);
  const focus=(n,delay=280)=>{n.classList.add('netflix-tv-focus');n.style.setProperty('--tv-delay',delay+'ms');return n;};
  const row=(cls,...children)=>{const n=node(null,cls);n.append(...children);return n;};
  const typed=text=>row('netflix-tv-typed',...[...text].map((char,i)=>{const n=create('span',char);n.style.setProperty('--letter-delay',100+65*i+'ms');return n;}));
  if(mode==='sign-in'){
   scene.append(row('netflix-tv-start',create('u','Privacy'),row('netflix-tv-start-buttons',focus(key('Sign in','netflix-tv-red')),key('Get Started','netflix-tv-light'))));return scene;
  }
  if(mode==='link'){
   const mail=node(null,'netflix-tv-mail');mail.innerHTML=lineIcon('M2 5h20v14H2z M2 5l10 8 10-8');mail.setAttribute('aria-hidden','true');
   const note=create('p');note.append("Simply tap the one-time link we'll send to ",create('strong',sample),' to',create('br'),'sign in to this TV.');
   scene.append(row('netflix-tv-link',mail,create('h3','Sign in without a password'),note,row('netflix-tv-link-buttons',key('Send Sign-In Link'),focus(key('Use Password Instead')))));return scene;
  }
  const remote=mode==='remote',password=mode==='password';
  scene.append(node('NETFLIX','netflix-tv-brand'),row('netflix-tv-heading',create('h3','Choose how to sign in'),row('netflix-tv-methods',key('Use Phone',remote?'selected':''),remote?focus(key('Use Remote')):key('Use Remote','selected'))));
  const support=row('netflix-tv-support',node("Don't have an account?"),key('Sign Up Now'),node('Need help signing in?'),node('Visit https://help.netflix.com/contactus'));
  scene.append(support);
  if(remote){
   const qr=node(null,'netflix-tv-qr');qr.setAttribute('aria-label','Nümayiş üçün işləməyən QR nümunəsi');
   const first=row('netflix-tv-qr-col',row('netflix-tv-qr-copy',key('1'),node("Use your phone or tablet's camera and point to this code, or go to netflix.com/tv2")),qr);
   const second=row('netflix-tv-qr-col',row('netflix-tv-qr-copy',key('2'),node('Confirm this code on your phone or tablet')),node('0000-0000','netflix-tv-code'));
   scene.append(row('netflix-tv-pair',first,second));return scene;
  }
  const rows=[
   ['1','2','3','4','5','6','7','8','9','0'],
   [...'qwertyuiop'],
   [...'asdfghjkl-'],
   ['↑',...'zxcvbnm',password?"'":'_'],
   ...(password?[]:[['@hotmail.com','@gmail.com','@yahoo.com']]),
   password?['!#$','àáâ','␣','⌫']:['!#$','@','.','.com','⌫']
  ];
  const keyboard=row('netflix-tv-keyboard',...rows.map((letters,i)=>row('netflix-tv-key-row netflix-tv-row-'+i,...letters.map(t=>key(t)))));
  const actions=row('netflix-tv-actions',key(password?'Previous':'Back'),focus(key('Next'),password?740:1330));
  const extra=row('netflix-tv-extra',key('Forgot password?'),password?key('Hide Password'):row('netflix-tv-remember',key('✓'),create('span','Remember Email')));
  const controls=row('netflix-tv-controls',node(password?'Enter your password':'Enter your email address'),keyboard,actions,extra);
  const fields=row('netflix-tv-fields',...(password?[node(sample),row('netflix-tv-field',typed('••••••••'))]:[row('netflix-tv-field',typed(sample))]));
  if(password)fields.lastChild.prepend(create('span','Password (4-60 characters)','netflix-tv-placeholder'));
  scene.append(row('netflix-tv-entry',controls,fields));return scene;
 }
 function netflixDesktopScreen(mode,create){
  const scene=create('div',null,'netflix-desktop-scene');
  scene.dataset.scene=mode;scene.lang='en';scene.setAttribute('inert','');
  const span=(text,cls)=>create('span',text,cls);
  const target=(node,delay=0)=>{node.classList.add('netflix-desktop-target');node.style.setProperty('--click-delay',delay+'ms');return node;};
  const typed=text=>{const row=span(null,'netflix-desktop-typed');for(const [i,char] of [...text].entries()){const letter=span(char);letter.style.setProperty('--letter-delay',100+55*i+'ms');row.append(letter);}return row;};
  const sample='hesab@example.com';
  const help=open=>{
   const h=create('div',null,'netflix-desktop-help');
   const title=span('Get Help','netflix-desktop-help-label');title.dataset.open=String(open);
   h.append(mode==='code'?target(title):title);
   if(open){
    const list=create('ul');
    for(const [i,label] of ["I can't access this email right now",'Use password instead','Learn more about sign-in'].entries()){
     const li=create('li'),option=span(label);li.append(i===1?target(option):option);list.append(li);
    }
    h.append(list);
   }
   return h;
  };
  if(mode==='home'){
   const picture=create('img');picture.src='https://mirpanel.com/assets/netflix-guide-home.png';picture.alt='Netflix ana səhifəsi';picture.referrerPolicy='no-referrer';
   scene.append(picture,target(span('Sign In','netflix-desktop-home-signin')));
   return scene;
  }
  scene.append(create('header','NETFLIX','netflix-desktop-brand'));
  const main=create('div',null,'netflix-desktop-main');
  const button=(label,secondary=false)=>create('div',label,'netflix-desktop-button'+(secondary?' secondary':''));
  const account=()=>{const n=create('div',null,'netflix-desktop-account');n.append(span(sample),create('u','Change'));return n;};
  const notice=()=>create('p',"This page is protected by Google reCAPTCHA to ensure you're not a bot.",'netflix-desktop-notice');
  if(mode==='email'){
   const field=create('div',null,'netflix-desktop-field');field.append(span('Email or mobile number'),typed(sample));
   main.append(create('h3','Enter your info to sign in'),create('p','Or get started with a new account.','netflix-desktop-subtitle'),field,target(button('Continue'),1220),help(false),notice());
  }else if(mode==='code'||mode==='help'){
   const boxes=create('div',null,'netflix-desktop-code-boxes');for(let i=0;i<4;i++)boxes.append(span());
   const expiry=create('p','This code will expire in 15 minutes.','netflix-desktop-expiry');
   expiry.append(create('br'),"Didn't get a code? ",create('u','Resend code.'));
   main.append(create('h3','Enter the code we sent to your email'),account(),boxes,expiry,help(mode==='help'));
  }else{
   const field=create('div',null,'netflix-desktop-field');field.append(span('Password'),typed('••••••••'));
   main.append(create('h3','Enter your password'),account(),field,target(button('Sign In'),780),span('or','netflix-desktop-or'),button('Use Sign-in Code',true),help(false),notice());
  }
  scene.append(main);return scene;
 }
 function capcutScreen(mode,create){
  const screen=create('div',null,'capcut-demo capcut-demo-'+mode);
  screen.dataset.animation=mode;
  const icons={
   logo:'M4 5h16L4 19h16L4 5m0 4 16 6M20 9 4 15',
   user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
   video:'M3 6h18v12H3z M10 9l5 3-5 3z',
   photo:'M3 4h18v16H3z M4 17l5-6 4 4 3-3 5 5',
   mail:'M3 5h18v14H3z M3 6l9 7 9-7',
   back:'m14 5-7 7 7 7',
   search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
   edit:'m4 16 11-11 4 4L8 20H4v-4Zm9-9 4 4',
   share:'M13 4l8 7-8 7v-4c-5 0-8 2-10 5 0-7 3-11 10-11V4Z',
   lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z',
   box:'M3 8l4-5h10l4 5v13H3V8Zm0 0h18m-12 5h6'
  };
  const icon=name=>{const n=create('span',null,'capcut-demo-icon');n.innerHTML=lineIcon(icons[name]);return n;};
  const label=(text,cls)=>create('span',text,cls);
  const row=(text,name,cls)=>{const n=create('div',null,cls);if(name)n.append(icon(name));n.append(label(text));return n;};
  const mark=(node,target)=>{node.dataset.capcutTarget=target;return node;};
  const type=(text,stars=false)=>{
   const out=create('span',null,'capcut-demo-typing');out.setAttribute('aria-label',stars?'Nümunə şifrə':text);
   [...text].forEach((char,i)=>{const n=label(char);n.setAttribute('aria-hidden','true');n.style.setProperty('--type-delay',(i*55+160)+'ms');out.append(n);});return out;
  };
  const brand=()=>row('CapCut','logo','capcut-demo-brand');
  if(mode==='ben'){
   const header=create('div',null,'capcut-demo-top');header.append(brand(),icon('search'));
   const hero=create('div',null,'capcut-demo-hero');hero.append(label('Video düzenleme'),create('strong','Başlayın'));
   const tools=create('div',null,'capcut-demo-tools');tools.append(row('Yeni video','video'),row('Fotoğraf düzenle','photo'));
   const nav=create('div',null,'capcut-demo-nav');nav.append(row('Düzenle','video'),row('Şablonlar','photo'),mark(row('Ben','user'),'ben'));
   screen.append(header,hero,tools,nav);
  }else if(mode==='sign-in'){
   screen.append(row('Oturum aç','back','capcut-demo-heading'),brand());
   const options=create('ol',null,'capcut-demo-options');
   for(const [i,name] of ["TikTok ile giriş yap","Google ile oturum aç","E-postayla giriş yapın","Facebook ile giriş yap","Apple ile oturum açın"].entries()){
    const li=create('li',null,'capcut-demo-option');
    if(i===2){li.append(icon('mail'));mark(li,'email-option');}
    li.append(label(name));options.append(li);
   }
   screen.append(options);
  }else if(mode==='email'||mode==='password'){
   screen.append(row('Oturum aç','back','capcut-demo-heading'),brand());
   const fields=create('div',null,'capcut-demo-fields');
   const email=create('div',null,'capcut-demo-field'),pass=create('div',null,'capcut-demo-field');
   email.append(label('E-posta'),mode==='email'?type('numune@example.com'):label('numune@example.com'));
   pass.append(label('Şifre'),mode==='password'?type('********',true):label('Şifreyi girin','capcut-demo-muted'));
   mark(mode==='email'?email:pass,mode);
   const next=create('div','Devam','capcut-demo-next');
   if(mode==='password')mark(next,'continue');
   fields.append(email,pass,next);screen.append(fields);
  }else{
   screen.append(icon('back'));
   const profile=create('div',null,'capcut-demo-profile');
   const avatar=label(null,'capcut-demo-avatar');avatar.append(icon('user'));
   const identity=create('div'),name=create('div',null,'capcut-demo-profile-name');
   name.append(create('strong','numune042'),mark(label('Pro','capcut-demo-pro'),'pro'));
   identity.append(name,label('ID: 10420001','capcut-demo-muted'));profile.append(avatar,identity);
   const stats=create('div',null,'capcut-demo-stats');
   for(const text of ['Takip edilenler','Takipçiler']){
    const stat=create('div');stat.append(create('strong','0'),label(text));stats.append(stat);
   }
   const actions=create('div',null,'capcut-demo-profile-actions'),share=create('span',null,'capcut-demo-option');
   share.append(icon('share'));actions.append(create('div','Profili düzenle','capcut-demo-option'),share);
   const profileTabs=create('div',null,'capcut-demo-profile-tabs'),favorites=label('Favoriler');
   favorites.append(icon('lock'));profileTabs.append(favorites,label('Beğenilen içerik'));
   screen.append(profile,stats,row('Biyografi ekle','edit','capcut-demo-bio'),actions,profileTabs,row('Henüz favori yok.','box','capcut-demo-empty'));
  }
  return screen;
 }
 function openGuide(trigger,accounts,initialTab='info'){
  const line=trigger.closest('.browser-order-line'),order=trigger.closest('[data-order-id]'),index=Number(line.querySelector('[data-order-info]').dataset.orderInfo),item=guideItems.get(order)?.[index];
  if(!item||guideDialog.open)return;
  const create=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(label,action)=>{const b=create('button',label);b.type='button';b.onclick=action;return b;};
  const wrap=create('div',null,'browser-guide-frame'),header=create('header',null,'browser-guide-header'),title=create('h2',item.title);title.id='browserOrderGuideTitle';
  const identity=create('div');identity.append(title,create('p',item.planName));
  const close=button('×',()=>guideDialog.close());close.setAttribute('aria-label','Təlimatı bağla');
  const head=create('div',null,'browser-guide-identity');head.append(identity,close);
  const tabs=create('div',null,'browser-guide-tabs'),body=create('div',null,'browser-guide-body'),footer=create('footer');
  const deliveryStatus=accounts.querySelector('[data-delivery]')?null:accounts.querySelector('p')?.textContent;
  const primeDelivered=item.productId==='prime'&&Boolean(accounts.querySelector('[data-delivery]'));
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Təlimat bölmələri');
  footer.append(button('Bağla',()=>guideDialog.close()));
  let data=null,failed=false,active=primeDelivered?'steps':initialTab,track=primeDelivered?'phone':'',step=0,autoplay=false,advanceTimer,phoneTouchStart,phoneTouchEnd,phoneTouchCancel;
  const phoneShell=create('div',null,'browser-guide-handset'),phoneScreen=create('div',null,'browser-guide-handset-screen');
  phoneShell.append(phoneScreen);
  const capcutStage=create('div',null,'capcut-pc-stage'),scanSlot=create('div',null,'capcut-pc-scan-slot');
  const laptop=create('div',null,'netflix-laptop'),laptopScreen=create('div',null,'netflix-laptop-screen'),deck=create('div',null,'netflix-laptop-deck'),keys=create('div',null,'netflix-laptop-keyboard');
  for(let i=0;i<48;i++)keys.append(create('i'));
  deck.setAttribute('aria-hidden','true');deck.append(keys,create('div',null,'netflix-laptop-touchpad'));laptop.append(laptopScreen,deck);
  const tv=create('div',null,'netflix-tv'),tvScreen=create('div',null,'netflix-tv-screen'),remote=create('div',null,'netflix-tv-remote');
  remote.setAttribute('aria-hidden','true');remote.append(create('i'),create('b'),create('i'),create('i'));
  tv.append(tvScreen,create('div',null,'netflix-tv-feet'),remote);
  const info=button('Məlumat',()=>select('info')),how=button('Təlimat',()=>select('steps'));tabs.append(info,how);
  function select(mode){autoplay=false;active=mode;wrap.scrollTop=body.scrollTop=0;draw();}
  function draw(){
   clearTimeout(advanceTimer);
   info.setAttribute('aria-pressed',String(active==='info'));how.setAttribute('aria-pressed',String(active==='steps'));
   if(failed){body.replaceChildren(create('p','Təlimat alınmadı.'),button('Yenidən cəhd et',loadGuide));return;}
   if(!data){const loading=create('p','Məlumat hazırlanır…');loading.setAttribute('role','status');body.replaceChildren(loading);return;}
   if(active==='info'){
    phoneScreen.replaceChildren();body.replaceChildren();
    if(data.information)body.append(create('div','İstifadə etməzdən əvvəl oxuyun','browser-guide-note'));
    body.append(data.information?renderInformation(data.information):create('p','Bu məhsul üçün məlumat əlavə edilməyib.','browser-guide-text'));return;
   }
   const tracks=Object.entries({general:'Ümumi addımlar',phone:data.tracks?.desktop?'Telefonla giriş':'Telefonda giriş',desktop:'Kompüterlə giriş',tv:'Televizorda giriş',desktopQr:'Kompüterdə QR ilə giriş'}).filter(([key])=>data.tracks?.[key]?.length);
   if(!tracks.length){body.replaceChildren(create('p','Bu paket üçün şəkilli təlimat əlavə edilməyib.'));return;}
   if(!tracks.some(([key])=>key===track))track=tracks[0][0];
   const choices=create('div',null,'browser-guide-choices');
   for(const [key,label] of tracks){
    const animation=data.tracks[key].find(step=>step.animation)?.animation;
    const title=key!=='phone'||!animation||animation.startsWith('netflix-')?label:
     /^(spotify|prime|chatgpt)-/.test(animation)?'Telefonla giriş':'CapCut-a daxil ol';
    const b=button(title,()=>{autoplay=false;track=key;step=0;draw();});
    b.setAttribute('aria-pressed',String(track===key));choices.append(b);
   }
   const steps=data.tracks[track],current=steps[step],layout=create('div',null,'browser-guide-step');
   const capcutDesktop=track==='desktop'&&current.animation?.startsWith('capcut-desktop-');
   const desktop=capcutDesktop||track==='desktop'&&current.animation?.startsWith('netflix-desktop-');
   const television=track==='tv'&&current.animation?.startsWith('netflix-tv-');
   const compact=television||desktop||track==='phone'&&steps.some(item=>item.animation);
   if(compact)layout.classList.add('browser-guide-compact');
   const netflix=track==='phone'&&current.animation?.startsWith('netflix-');
   const spotify=track==='phone'&&current.animation?.startsWith('spotify-');
   const prime=track==='phone'&&current.animation?.startsWith('prime-');
   const chatgpt=track==='phone'&&current.animation?.startsWith('chatgpt-');
   const simulated=netflix||spotify||prime||chatgpt;
   if(simulated||desktop||television)layout.classList.add('netflix-guide');
   const visual=create('div',null,'browser-guide-visual');
   const handset=simulated||track==='phone'&&['ben','sign-in','email','password','pro'].includes(current.animation)&&/^\/uploads\/guides\/capcut-mobile\/[1-5]\.png$/.test(current.image?.replace(/^https:\/\/mirpanel\.com(?=\/)/,'')||'');
   const steadyLayout=television&&body.contains(tv)?tv.closest('.browser-guide-step'):desktop&&body.contains(laptop)?laptop.closest('.browser-guide-step'):handset&&body.contains(phoneShell)?phoneShell.closest('.browser-guide-step'):null;
   if(television){
    layout.classList.add('netflix-desktop-guide','netflix-tv-guide');
    tvScreen.replaceChildren(netflixTvScreen(current.animation.slice('netflix-tv-'.length),create));
    if(!steadyLayout)visual.append(tv);
   }else if(desktop){
    layout.classList.add('netflix-desktop-guide');
    if(capcutDesktop){
     const scene=current.animation.slice('capcut-desktop-'.length);
     capcutStage.dataset.scene=scene;
     laptopScreen.replaceChildren(capcutDesktopScreen(scene,create));
     scanSlot.replaceChildren(...(scene==='scan'?[capcutScanPhone(create)]:[]));
     if(!steadyLayout){capcutStage.append(laptop,scanSlot);visual.append(capcutStage);}
    }else{
     laptopScreen.replaceChildren(netflixDesktopScreen(current.animation.slice('netflix-desktop-'.length),create));
     if(!steadyLayout)visual.append(laptop);
    }
   }else if(handset){
    visual.classList.add('browser-guide-visual-handset');
    phoneScreen.replaceChildren(chatgpt?chatgptScreen(current.animation,create):prime?primeScreen(current.animation,create):spotify?spotifyScreen(current.animation,create):netflix?netflixScreen(current.animation,create):capcutScreen(current.animation,create));
    phoneShell.classList.toggle('netflix-handset',simulated);
    phoneShell.classList.toggle('spotify-handset',spotify);
    phoneShell.classList.toggle('prime-handset',prime);
    phoneShell.classList.toggle('chatgpt-handset',chatgpt);
    if(!steadyLayout)visual.append(phoneShell);
   }else
   try{
    const u=new URL(current.image,location.origin);
    if((u.protocol==='https:'||u.origin===location.origin)&&!u.username&&!u.password){
     const img=create('img');img.src=u.href;img.alt='Addım '+(step+1);img.referrerPolicy='no-referrer';
     const frame=create('div',null,'browser-guide-phone');
     frame.append(img);
     if(['ben','sign-in','email','password','pro'].includes(current.animation)){
      frame.dataset.animation=current.animation;
      const highlight=create('span',null,'browser-guide-highlight');
      highlight.setAttribute('aria-hidden','true');frame.append(highlight);
      if(current.animation==='email'||current.animation==='password'){
       const typing=create('span',current.animation==='email'?'numune@example.com':'********','browser-guide-typing');
       typing.setAttribute('aria-hidden','true');frame.append(typing);
      }
      if(current.animation==='password')frame.append(create('span',null,'browser-guide-continue'));
     }
     img.addEventListener('error',()=>visual.replaceChildren(create('span','Şəkil açıla bilmədi.')),{once:true});
     visual.append(frame);
    }
   }catch{}
   const details=create('div');
   const description=create('p',current.description,'browser-guide-text'+(handset?' capcut-demo-description':''));description.setAttribute('aria-live','polite');
   if(compact){
    const number=create('strong',String(step+1),'browser-guide-step-number');
    number.setAttribute('aria-label','Addım '+(step+1)+' / '+steps.length);
    description.prepend(number);
   }else details.append(create('strong','Addım '+(step+1)+' / '+steps.length,'browser-guide-note'));
   const nav=create('div',null,'browser-guide-controls');
   const go=(index,focus)=>{
    if(index<0||index>=steps.length)return;
    autoplay=false;step=index;draw();
    if(focus)body.querySelector('.browser-guide-controls button'+focus+':not(:disabled),.browser-guide-controls button:not(:disabled)')?.focus({preventScroll:true});
   };
   const back=button('‹ Əvvəlki',()=>go(step-1,':first-child')),next=button('Növbəti ›',()=>go(step+1,':last-child'));
   if(compact){
    for(const [arrow,icon,label] of [[back,'‹','Əvvəlki'],[next,'›','Növbəti']]){
     const glyph=create('span',handset?null:icon);
     if(handset)glyph.innerHTML=lineIcon(arrow===back?'m15 5-7 7 7 7':'m9 5 7 7-7 7');
     glyph.setAttribute('aria-hidden','true');
     arrow.replaceChildren(glyph);arrow.setAttribute('aria-label',label);
    }
   }
   back.disabled=step===0;next.disabled=step===steps.length-1;
   nav.append(back,next);details.append(description,nav);
   if(steps.length>1){
    const dots=create('div',null,'browser-guide-dots');dots.setAttribute('role','group');dots.setAttribute('aria-label','Təlimat addımları');
    steps.forEach((_,index)=>{
     const dot=button('',()=>{go(index);body.querySelector('.browser-guide-dots [aria-current="step"]')?.focus({preventScroll:true});});
     dot.setAttribute('aria-label','Addım '+(index+1));
     if(index===step)dot.setAttribute('aria-current','step');
     dots.append(dot);
    });
    const play=button(autoplay?'Dayandır':'Avtomatik göstər',()=>{
     autoplay=!autoplay;
     if(autoplay&&step===steps.length-1)step=0;
     draw();body.querySelector('.browser-guide-play')?.focus({preventScroll:true});
    });
    play.className='browser-guide-play';
    if(simulated)details.append(create('small',prime?'Nümunə ekran · Məlumatı yalnız rəsmi Prime Video tətbiqində daxil edin.':chatgpt&&['chatgpt-authenticator','chatgpt-code'].includes(current.animation)?'Bu, işləməyən nümunədir. Həqiqi 2FA açarını paylaşmayın; onu etibar etdiyiniz doğrulama tətbiqində saxlayın.':'Düymələrin dili və görünüşü cihazınıza görə fərqlənə bilər.','netflix-guide-note'));
    if(compact){
     const icon=create('span',autoplay?'Ⅱ':'▶');icon.setAttribute('aria-hidden','true');play.prepend(icon);
     next.before(dots);details.append(play);
    }else details.append(dots,play);
    let touch;
    const swipeStart=e=>{touch=e.touches.length===1?{clientX:e.touches[0].clientX,clientY:e.touches[0].clientY}:null;};
    if(simulated){
     if(phoneTouchStart)phoneShell.removeEventListener('touchstart',phoneTouchStart);
     phoneTouchStart=swipeStart;phoneShell.addEventListener('touchstart',phoneTouchStart,{passive:true});
    }
    else layout.addEventListener('touchstart',swipeStart,{passive:true});
    if(simulated){
     if(phoneTouchCancel)phoneShell.removeEventListener('touchcancel',phoneTouchCancel);
     phoneTouchCancel=()=>{touch=null;};phoneShell.addEventListener('touchcancel',phoneTouchCancel);
    }else layout.addEventListener('touchcancel',()=>{touch=null;});
    const swipeEnd=e=>{
     if(!touch||!e.changedTouches.length)return;
     const {clientX,clientY}=e.changedTouches[0],dx=clientX-touch.clientX,dy=clientY-touch.clientY;
     touch=null;
     if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.3)go(step+(dx<0?1:-1));
    };
    if(simulated){
     if(phoneTouchEnd)phoneShell.removeEventListener('touchend',phoneTouchEnd);
     phoneTouchEnd=swipeEnd;phoneShell.addEventListener('touchend',phoneTouchEnd,{passive:true});
    }
    else layout.addEventListener('touchend',swipeEnd,{passive:true});
   }
   if(steadyLayout){steadyLayout.lastElementChild.replaceWith(details);
    steadyLayout.dispatchEvent(new CustomEvent('guide-step-changed'));
   }
   else{
    layout.append(visual,details);body.replaceChildren(choices,layout);
    if(handset&&deliveryStatus)body.append(create('p',deliveryStatus,'browser-guide-delivery-status browser-guide-handset-status'));
   }
   if(autoplay&&step<steps.length-1)advanceTimer=setTimeout(()=>{
    if(!guideDialog.open||!guideDialog.isConnected)return;
    step++;autoplay=step<steps.length-1;draw();
    },simulated||desktop||television?5000:4200);
  }
  async function loadGuide(){
   const turn=++guideTurn;failed=false;draw();
   try{const result=await api('my-orders/'+encodeURIComponent(order.dataset.orderId)+'/guide/'+index);if(turn===guideTurn&&guideDialog.open){data=result;draw();}}
   catch(e){if(turn!==guideTurn||!guideDialog.open)return;if(e.status===401||e.status===403){gate();return;}failed=true;draw();}
  }
  header.append(head,tabs);
  if(deliveryStatus)header.append(create('p',deliveryStatus,'browser-guide-delivery-status'));
  wrap.append(header,body,footer);guideDialog.replaceChildren(wrap);root.after(guideDialog);
  guideDialog.addEventListener('close',()=>{autoplay=false;phoneScreen.replaceChildren();clearTimeout(advanceTimer);guideTurn++;guideDialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});},{once:true});
  guideDialog.showModal();void loadGuide();
 }
 function buyAgain(selection){
  if(repeatDialog.open)return;
  repeatDialog.innerHTML='<h2 id="browserOrderRepeatTitle">Yenidən almaq</h2><p>Bu, yeni sifariş olacaq. Məhsul ödənişdən sonra ayrıca təqdim olunur. Əvvəlki sifarişiniz dəyişmir.</p><p role="status" data-repeat-status></p><div><button type="button" data-repeat-cancel autofocus>Ləğv et</button><button type="button" data-repeat-add>Səbətə əlavə et</button></div>';
  repeatDialog.setAttribute('aria-labelledby','browserOrderRepeatTitle');root.after(repeatDialog);
  const cancel=repeatDialog.querySelector('[data-repeat-cancel]'),add=repeatDialog.querySelector('[data-repeat-add]'),status=repeatDialog.querySelector('[data-repeat-status]');
  cancel.onclick=()=>repeatDialog.close();
  if(!selection){add.disabled=true;status.textContent='Bu məhsul və ya əvvəlki paket hazırda satışda deyil və ya müəyyən edilə bilmədi.';}
  add.onclick=async()=>{if(add.disabled)return;add.disabled=true;
   try{const {startCartEntry}=await import('/community-assets/cart-entry.js?v=order-cards-20261108');if(!repeatDialog.open||!add.isConnected)return;
    const plan={label:selection.planName},plans=[];plans[selection.planIndex]=plan;
    repeatDialog.close();
    await startCartEntry({id:selection.productId,title:selection.title,plans},plan,{repeatPlanName:selection.planName,repeatPlanKey:selection.planKey??null});
   }catch{const msg='Sifariş pəncərəsini açmaq mümkün olmadı. Yenidən cəhd edin.';if(repeatDialog.open&&add.isConnected)status.textContent=msg;else if(root.isConnected){error.textContent=msg;error.hidden=false;}}
   finally{add.disabled=!selection;}
  };
  repeatDialog.showModal();
 }
 on(root,'click',e=>{
  const deliveryGuide=e.target.closest('[data-delivery-guide]');
  if(deliveryGuide){
   e.preventDefault();
   return openGuide(deliveryGuide,deliveryGuide.closest('.browser-order-instructions'),'steps');
  }
  const info=e.target.closest('[data-order-info]'),again=e.target.closest('[data-buy-again]');
  if(info)return openGuide(info,info.closest('.browser-order-line').querySelector('.browser-order-instructions'));
  if(again)return buyAgain(repeats.get(again.closest('[data-order-id]'))?.[Number(again.dataset.buyAgain)]);
  const b=e.target.closest('[data-copy-delivery],[data-copy-delivery-field]');if(b)void copyDelivery(b);
  const retry=e.target.closest('[data-retry-delivery]');if(retry)void loadDelivery(retry.closest('[data-delivery]'),true);
 });
 root.addEventListener('click',async e=>{if(e.target.closest('[data-retry]'))return void load();const b=e.target.closest('[data-receipt]');if(!b||b.disabled)return;const run=generation;b.disabled=true;try{const d=await api('my-orders/'+encodeURIComponent(b.dataset.receipt)+'/receipt');if(run!==generation)return;const u=new URL(d.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error();content.replaceChildren();const view=document.createElement(d.mime==='application/pdf'?'iframe':'img');view.src=u.href;view.referrerPolicy='no-referrer';if(view.tagName==='IMG')view.alt='Sifarişin ödəniş çeki';else{view.title='Ödəniş çeki PDF';view.setAttribute('sandbox','allow-same-origin');}content.append(view);dialog.showModal();}catch(e){if(run!==generation)return;if(e.status===401||e.status===403)return void gate();error.textContent=e.status===410?'Çek artıq mövcud deyil':'Çeki açmaq mümkün olmadı. Yenidən cəhd edin.';error.hidden=false;}finally{b.disabled=false;}});
 document.getElementById('browserReceiptClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>content.replaceChildren());
 const start=()=>{clearInterval(timer);timer=setInterval(()=>{if(loaded&&!document.hidden&&!dialog.open&&!guideDialog.open&&!repeatDialog.open)load(false,true);},12000);};
 on(window,'mirpanel:account',e=>{const uid=e.detail?.user_id||e.detail?.id;if(!uid||accountId&&uid!==accountId)gate();else if(!loaded)load();});
 on(window,'storage',e=>{if(e.key==='mirpanel.auth.signedOut')gate();});
 // Keep revealed data in this verified document until sign-out or account change.
 on(document,'visibilitychange',()=>{
  if(!document.hidden){
   root.querySelectorAll('[data-order-id][open]').forEach(showAccounts);
   if(loaded&&!guideDialog.open&&!repeatDialog.open)void load(false,true);
  }else{content.replaceChildren();if(dialog.open)dialog.close();}
 });
 const dispose=()=>{clearInterval(timer);clear();life.abort();};
 on(window,'pagehide',e=>{if(e.persisted)clearInterval(timer);else dispose();});
 on(window,'pageshow',e=>{if(e.persisted){start();void load(false,true);}});
 start();if(options.initial)paint(options.initial);load(false,!!options.initial);window.mirpanelPageDispose=dispose;return dispose;
 };if(!window.mirpanelNavigationMounting&&!window.mirpanelAccountMounting)window.mountBrowserOrders();
})();
