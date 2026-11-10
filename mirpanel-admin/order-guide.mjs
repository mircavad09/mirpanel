export const netflixPhoneSteps=[
 ['netflix-open',"Netflix-i açın və sağ üstdəki ‘Sign In’ düyməsinə toxunun."],
 ['netflix-email',"Sizə təqdim olunan e-poçtu yazın və ‘Continue’ düyməsinə toxunun."],
 ['netflix-code',"Dördrəqəmli giriş kodu tələb olunarsa, ‘Get Help’ seçin."],
 ['netflix-help',"Açılan seçimlərdən ‘Use password instead’ seçin."],
 ['netflix-password',"Sizə təqdim olunan şifrəni yazın və qırmızı ‘Sign In’ düyməsinə toxunun."]
].map(([animation,description])=>({animation,description,image:''}));
const spotifyPhoneSteps=[
 ['spotify-open','Spotify tətbiqini açın və «Oturum aç» düyməsinə toxunun.'],
 ['spotify-email','Spotify hesabınızın e-poçt ünvanını yazın və «Devam et» düyməsinə toxunun.'],
 ['spotify-code','Kod ekranı açılarsa, aşağıdakı «Parola ile oturum aç» seçiminə toxunun.'],
 ['spotify-password','Spotify şifrənizi yazın və «Oturum aç» düyməsinə toxunun.'],
 ['spotify-premium','Profil menyusunu açın. «Premium üyeliğin» sətrində yaşıl «Bireysel» nişanını yoxlayın.']
].map(([animation,description])=>({animation,description,image:''}));
const primePhoneSteps=[
 ['prime-email','«Giriş yapın» seçili qalsın. Sizə təqdim olunan e-poçtu yazın və «Devam Et» düyməsinə toxunun.'],
 ['prime-password','Sizə təqdim olunan şifrəni «Amazon şifresi» xanasına yazın və «Giriş yap» düyməsinə toxunun.'],
 ['prime-passkey','Bu ekran yalnız keçid açarı təklifi çıxarsa lazımdır. «Hayır, parola kullanmaya devam et» düyməsinə toxunun.']
].map(([animation,description])=>({animation,description,image:''}));
const chatgptPhoneSteps=[
 ['chatgpt-open','ChatGPT tətbiqini açın və «Oturum aç veya kaydol» düyməsinə toxunun.'],
 ['chatgpt-email','Sizə təqdim etdiyimiz e-poçtu «E-posta» xanasına yazın və «Devam» düyməsinə basın.'],
 ['chatgpt-password','Sizə təqdim etdiyimiz şifrəni «Parola» xanasına yazın və «Devam» düyməsinə basın.'],
 ['chatgpt-verification','«Kod» xanasını hələ boş saxlayın. Buraya növbəti addımlarda alınan 6 rəqəmli kod daxil ediləcək.'],
 ['chatgpt-authenticator','Sizə göndərdiyimiz 2FA.live keçidini açın. Təqdim etdiyimiz uzun 2FA açarını birinci «2FA Secret» xanasına yapışdırın və «Submit» düyməsinə basın.'],
 ['chatgpt-code','Aşağıdakı «2FA Code» xanasında nəticənin sonundakı yalnız 6 rəqəmi kopyalayın.'],
 ['chatgpt-return','ChatGPT-yə qayıdın. Kopyaladığınız 6 rəqəmi «Kod» xanasına yapışdırın və «Devam» düyməsinə basın.']
].map(([animation,description])=>({animation,description,image:''}));
const capcutDesktopSteps=[
 ['capcut-desktop-open','CapCut-u kompüterdə açın. «Join Pro» yazısının üstündəki «Sign Up» və ya «Sign in» düyməsinə basın.'],
 ['capcut-desktop-choose','Giriş pəncərəsində «Use QR code» seçin. QR kodu solda, telefonla oxutma qaydası sağda görünür.'],
 ['capcut-desktop-scan','CapCut tətbiqində «Ben» bölməsini açın, «Scan» seçin və kompüterinizdə göstərilən QR kodu oxudun.']
].map(([animation,description])=>({animation,description,image:''}));
const guideAnimations=new Set(['ben','sign-in','email','password','pro']);
const netflixDesktopSteps=[
 ['home','Netflix ana səhifəsində sağ üstdəki “Sign In” düyməsinə klikləyin.'],
 ['email','Sizə təqdim olunan e-poçtu yazın və “Continue” düyməsinə klikləyin.'],
 ['code','Kod ekranında sol altdakı “Get Help” menyusunu açın.'],
 ['help','Açılan menyuda ikinci seçimə, “Use password instead” sətrinə klikləyin.'],
 ['password','Sizə təqdim olunan şifrəni yazın və qırmızı “Sign In” düyməsinə klikləyin.']
].map(([name,description])=>({animation:'netflix-desktop-'+name,description,image:''}));
const netflixTvSteps=[
 ['sign-in','Netflix tətbiqini açın və pultla «Sign in» düyməsini seçin.'],
 ['remote','Pultla davam etmək üçün sağdakı «Use Remote» seçimini seçin.'],
 ['email','E-poçt ünvanınızı ekran klaviaturası ilə yazın və «Next» seçin.'],
 ['link','Bu ekran açılarsa, «Use Password Instead» seçin.'],
 ['password','Şifrənizi ekran klaviaturası ilə yazın və «Next» seçin.']
].map(([name,description])=>({animation:'netflix-tv-'+name,description,image:''}));
export const guideTracks=['general','phone','desktopQr'];
export function phoneOnlyGuide(plan){
 const name=String(plan?.label||plan?.name||'');
 return plan?.orderGuide?.phoneOnly===true||(/(?:^|[^\p{L}])telefon(?:da|la)?(?:$|[^\p{L}])/iu.test(name)&&!/kompüter|desktop|(?:^|\W)pc(?:$|\W)/iu.test(name));
}
function imageUrl(value){
 const text=String(value??'').trim();
 if(!text||text.length>1500)return '';
 try{const url=new URL(text,'https://mirpanel.com');
  if(url.protocol!=='https:'||url.username||url.password)return '';
  if(text.startsWith('/'))return !text.startsWith('//')&&url.pathname.startsWith('/uploads/')?url.pathname+url.search:'';
  return /^https:\/\//i.test(text)?url.href:'';
 }catch{return '';}
}
export function normalizeOrderGuide(input,{product=false}={}){
 if(!input||typeof input!=='object')return undefined;
 const information=typeof input.information==='string'?input.information.trim().slice(0,12000):'';
 const tracks={};
 for(const name of product?['general','phone']:guideTracks){
  if(!Array.isArray(input.tracks?.[name]))continue;
  const steps=input.tracks[name].slice(0,12).map(s=>({
   ...(guideAnimations.has(s?.animation)?{animation:s.animation}:{}),
   image:imageUrl(s?.image),description:typeof s?.description==='string'?s.description.trim().slice(0,1500):''
  })).filter(s=>s.image&&s.description);
  if(steps.length)tracks[name]=steps;
 }
 const phoneOnly=!product&&input.phoneOnly===true;
 return information||Object.keys(tracks).length||phoneOnly?{information,tracks,...(phoneOnly?{phoneOnly}:{})}:undefined;
}
export function orderGuideFor(product,plan,savedName){
 const base=normalizeOrderGuide(product?.orderGuide,{product:true}),own=normalizeOrderGuide(plan?.orderGuide);
 const tracks={...base?.tracks,...own?.tracks};
 if(product?.id==='netflix'){
  tracks.phone=netflixPhoneSteps.map(step=>({...step}));
  tracks.desktop=netflixDesktopSteps.map(step=>({...step}));
  tracks.tv=netflixTvSteps.map(step=>({...step}));
 }
 if(product?.id==='capcut'){
  tracks.desktop=capcutDesktopSteps.map(step=>({...step}));
  delete tracks.desktopQr;
 }
 if(product?.id==='spotify')tracks.phone=spotifyPhoneSteps.map(step=>({...step}));
 if(product?.id==='chatgpt')tracks.phone=chatgptPhoneSteps.map(step=>({...step}));
 if(product?.id==='prime')tracks.phone=primePhoneSteps.map(step=>({...step}));
 if(phoneOnlyGuide(plan)||phoneOnlyGuide({label:savedName}))delete tracks.desktopQr;
 return {information:own?.information||base?.information||'',tracks};
}
