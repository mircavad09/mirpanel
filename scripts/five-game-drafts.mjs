import {epinbyProduct} from '../epinby-product.mjs';
import {supplierCost,exactMoney} from '../mirpanel-admin/epinby-finance.mjs';
import {epinbyStockState} from '../mirpanel-admin/epinby-stock.mjs';

const copy = {
 mobile_legends: {
  about:'Mobile Legends: Bang Bang üçün seçilmiş Weekly və Twilight paketlərinin oyun hesabına yüklənməsi. Paket oyunçu ID-si və təchizatçının tələb etdiyi server məlumatı ilə əlaqələndirilir. Hesab şifrəsi tələb olunmur.',
  rules:'Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir.',
 },
 honor_of_kings: {
  about:'Honor of Kings üçün Tokens və seçilmiş oyun paketləri. Yükləmə seçilmiş paket və həmin sifarişdə yazılmış User ID üzrə aparılır; oyun hesabının şifrəsi istənmir.',
  rules:'Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir.',
 },
 arena_breakout: {
  about:'Arena Breakout mobil versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout Infinite PC versiyası üçün deyil. Dəqiq nominal və valyuta seçiləcək təchizatçı paketi ilə müəyyən olunur, bannerdən götürülmür.',
  rules:'Mobil oyunun User ID / Player ID məlumatından istifadə edin. PC hesabı ilə qarışdırmayın. Satış qiyməti, cari təchizatçı paketi, hesab bölgəsi və valyuta təsdiqlənənədək sifariş bağlıdır.',
 },
 arena_breakout_infinite: {
  about:'Arena Breakout Infinite PC versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout mobil oyunu üçün deyil. Paket nominalı və oyun valyutası ayrıca təchizatçı məlumatı ilə təsdiqlənir.',
  rules:'PC oyunundakı Player ID-ni yoxlayın. Mobil Arena Breakout ID-sini daxil etməyin. Satış qiyməti, cari paket və Azərbaycan hesabına uyğunluq təsdiqlənənədək sifariş açılmır.',
 },
 stumble_guys: {
  about:'Stumble Guys üçün Gems, Tokens və qarışıq paket namizədləri. Hər nominal ayrıca təchizatçı ID-si ilə əlaqələndirilib. Bannerin Gems yazısı bütün paketlərin Gems olması demək deyil.',
  rules:'Player ID ilə yanaşı hesabın platforması və paketin valyutası təchizatçı üzrə dəqiqləşdirilməlidir. Mobil, PC və konsol hesablarının eyni qaydada işlədiyi fərz edilmir. Satış qiyməti və platforma uyğunluğu təsdiqlənənədək alış bağlıdır.',
 },
};
const norm = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const aliases = {
 mobile_legends:['Mobile Legends','Mobile Legends: Bang Bang'],
 honor_of_kings:['Honor of Kings'],
 arena_breakout:['Arena Breakout','Arena Breakout mobil'],
 arena_breakout_infinite:['Arena Breakout Infinite','Arena Breakout Infinite PC'],
 stumble_guys:['Stumble Guys'],
};

// This creates only inactive drafts. The dated workbook is never live stock or
// a current financial quote. Unpriced candidates remain in the review manifest,
// not zero-price offers in the store.
export function fiveGameDrafts(existing, manifest) {
 const products = structuredClone(existing), report=[];
 for(const definition of manifest.products){
  const candidates=manifest.packages.filter(p=>p.productId===definition.id);
  const already=products.find(p=>p.id===definition.id||aliases[definition.id].some(n=>norm(n)===norm(p.title))||
   p.plans?.some(plan=>candidates.some(c=>c.supplierProductId===Number(plan.supplier?.productId))));
  if(already){report.push({id:definition.id,existingId:already.id,added:false});continue;}
  const {about,rules}=copy[definition.id];
  const pending='Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.';
  const plans=candidates.filter(c=>c.targetPrice!=null).map(c=>{
   const supplier=epinbyProduct({provider:'epinby',productId:c.supplierProductId,type:c.type,
    gameId:c.gameId,categoryId:c.categoryId,fields:c.fields},'epinby_'+c.supplierProductId);
   if(!supplier)throw Error('Unsupported researched supplier mapping: '+c.supplierProductId);
   return {id:'epinby_'+c.supplierProductId,pricingId:'five-games-'+c.supplierProductId,
    label:c.name,price:Number(c.targetPrice),active:false,image:definition.image,supplier,
    formFields:supplier.fields,orderGuide:{information:rules+' '+pending,tracks:{}}};
  });
  products.push({id:definition.id,_stableId:definition.id,title:definition.title,
   order:Math.max(0,...products.map(p=>Number(p.order)||0))+1,category:'games',
   epinbyGroup:true,active:false,soldOut:false,stock:null,stockEnabled:false,
   currency:'₼',image:definition.image,imageAlt:definition.title+' — oyun məhsulunun banneri',
   banner:{enabled:false,desktopImage:definition.image,mobileImage:definition.image,alt:definition.title},
   desc:about,longDescription:about,usageRules:rules,note:pending,
   deliveryText:'',availabilityText:'',orderFlow:'form_then_whatsapp',
   formTitle:'Oyun hesabının məlumatları',formDescription:'Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.',
   formFields:candidates[0]?.fields||[],
   confirmationModal:{enabled:true,title:'Oyun hesabını yoxlayın',description:rules,
    confirmText:'Oxudum və təsdiqləyirəm',cancelText:'Geri',footerText:'',helpLink:{enabled:false,label:'',url:''}},
   orderGuide:{information:rules+' Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.',tracks:{}},
   seoSlug:definition.slug,seoH1:definition.title,
   seoTitle:definition.title+' paketləri | MirPanel',seoDescription:about.slice(0,300),
   seoIndex:false,includeInSitemap:false,plans});
  report.push({id:definition.id,added:true,draftPlans:plans.length,reviewCandidates:candidates.length});
 }
 return {products,report};
}

// Read-only review of a fresh account API record. The returned cost uses the
// existing financial system and must only be persisted by saveCatalogCost.
// This helper neither enables an offer nor writes historical order costs.
export function reviewFiveGamePackage(candidate,current,{complete=false,accountCatalog=false,
 regionConfirmed=false,platformConfirmed=false,competitorConfirmed=false,checkedAt}={}){
 const reasons=[];
 if(!accountCatalog||!complete)reasons.push('Cari tam hesab API kataloqu yoxlanmayıb.');
 if(!current||Number(current.id)!==candidate.supplierProductId||
  Number(current.game_id)!==candidate.gameId||Number(current.category_id)!==candidate.categoryId||
  current.type!==candidate.type||norm(current.name)!==norm(candidate.name))reasons.push('Paket ID-si, nominal, oyun və ya icra növü uyğun deyil.');
 if(current&&JSON.stringify(epinbyProduct({provider:'epinby',productId:current.id,type:current.type,fields:current.fields})?.fields)!==
  JSON.stringify(epinbyProduct({provider:'epinby',productId:candidate.supplierProductId,type:candidate.type,fields:candidate.fields})?.fields))reasons.push('Tələb olunan sahələr dəyişib.');
 const cost=supplierCost(accountCatalog&&complete?current:null,{source:'catalog',productId:candidate.supplierProductId,rate:'1.73',checkedAt});
 if(cost.reason)reasons.push(cost.reason);
 if(!regionConfirmed)reasons.push('Azərbaycan hesabı üçün bölgə şərti təsdiqlənməyib.');
 if(candidate.productId==='stumble_guys'&&!platformConfirmed)reasons.push('Platforma və oyun valyutası təsdiqlənməyib.');
 if(candidate.targetPrice==null)reasons.push('Təsdiqlənmiş satış qiyməti yoxdur.');
 else if(cost.azn!=null&&exactMoney(candidate.targetPrice)<=exactMoney(cost.azn))reasons.push('Satış qiyməti cari dəyişən xərcdən yüksək deyil.');
 if(!competitorConfirmed)reasons.push('Cari rəqib müqayisəsi təsdiqlənməyib.');
 const stock=accountCatalog&&complete?epinbyStockState(current):{status:'unknown',count:null};
 if(stock.status!=='available')reasons.push(stock.status==='out'?'Stokda yoxdur.':'Stok yoxlanıla bilmir.');
 return {ready:reasons.length===0,reasons,cost,stock};
}
