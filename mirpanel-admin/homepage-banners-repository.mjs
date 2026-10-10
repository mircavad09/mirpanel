import crypto from 'node:crypto';
import { detectStoryMedia } from './stories-repository.mjs';
export const BANNER_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status = 400, code = 'BANNER_INVALID') => Object.assign(new Error(message), {status, code});
const check = (result) => {
  if(result.error) {
    if(['42P01','PGRST205'].includes(result.error.code)) throw fail('Banner bazası hələ hazırlanmayıb. Banner migration-u tətbiq edilməlidir.',503,'BANNER_SCHEMA_REQUIRED');
    throw fail('Banner xidməti sorğunu tamamlaya bilmədi.',503,'BANNER_BACKEND_ERROR');
  }
  return result.data;
};
export function bannerLink(value) {
  const text=String(value || '').trim();
  if(!text) return '';
  if(text.length>2000 || /[\s\\\u0000-\u001f]/u.test(text)) throw fail('Keçid üçün təhlükəsiz HTTPS ünvanı və ya sayt daxilində yol yazın.');
  let parsed; try {parsed=new URL(text,'https://mirpanel.com');} catch {throw fail('Keçid ünvanı düzgün deyil.');}
  if(parsed.username || parsed.password || (text.startsWith('/') ? text.startsWith('//') || parsed.origin!=='https://mirpanel.com' : !/^https:\/\//i.test(text) || parsed.protocol!=='https:')) throw fail('Keçid üçün HTTPS ünvanı və ya sayt daxilində yol yazın.');
  return text;
}
function legacyImage(value) {
  const text=String(value || '').trim();
  return /^\/?(?:assets|uploads)\/[a-z0-9_./-]+\.(?:jpe?g|png|webp)(?:\?[^\s]*)?$/i.test(text) && !text.includes('..') ? text : '';
}
function bannerOptions(payload={}, previous={}) {
  const result={...previous};
  for(const [key,allowed] of [['placement',['main','side']],['focus',['center','left','right']]]) {
    if(payload[key]!==undefined) {if(!allowed.includes(payload[key])) throw fail('Banner yerləşməsi və fokus mövqeyi düzgün deyil.');result[key]=payload[key];}
  }
  if(payload.url!==undefined) result.url=bannerLink(payload.url);
  if(payload.newTab!==undefined) {if(typeof payload.newTab!=='boolean') throw fail('Keçid seçimi düzgün deyil.');result.newTab=payload.newTab;}
  if(payload.mobileImage!==undefined) {
    if(payload.mobileImage && !legacyImage(payload.mobileImage)) throw fail('Mobil banner şəkli düzgün deyil.');
    result.mobileImage=payload.mobileImage; if(!payload.mobileImage) delete result.mobileMediaPath;
  }
  return result;
}
export function createHomepageBannersRepository(client, {bucket, loadCatalog, now = () => Date.now()} = {}) {
  const table = () => client.from('homepage_banners');
  const storage = () => client.storage.from(bucket);
  const pending = new Map(), urls = new Map();
  async function rows() { return check(await table().select('*').order('sort_order').order('id')) || []; }
  async function one(id) { return check(await table().select('*').eq('id',id).maybeSingle()); }
  async function managed() { return Boolean(check(await client.from('homepage_banner_settings').select('initialized').eq('singleton',true).single())?.initialized); }
  async function initialize() {
    if(await managed()) {
      const current=await rows(), legacy=current.filter(row=>row.options?.placement===undefined);
      if(!legacy.length) return;
      // One-time upgrade of the old banner manager, only in an authenticated
      // admin read or trusted server startup. Explicit placement is the marker; deleted side panels are
      // never re-created on subsequent reads. Stable IDs make retries safe.
      const catalog=await loadCatalog();
      const presets=sideSeeds(catalog,Math.max(0,...current.map(row=>row.sort_order)));
      if(!current.some(row=>row.options?.placement==='side' && !presets.some(preset=>preset.id===row.id))) {
        for(const row of presets) {
          if(current.some(item=>item.id===row.id)) continue;
          const result=await table().insert(row);
          if(result.error?.code!=='23505') check(result);
        }
      }
      for(const row of legacy) check(await table().update({options:{...row.options,placement:'main',focus:'center'}}).eq('id',row.id).eq('updated_at',row.updated_at));
      return;
    }
    const catalog = await loadCatalog();
    const seed = (catalog.products || []).filter(p=>p.active!==false && p.banner?.enabled===true).map((p,index)=>({
      id:crypto.randomUUID(),legacy_image:String(p.banner.desktopImage || p.image || ''),title:String(p.banner.alt || p.title || 'Mirpanel ana səhifə banneri').slice(0,200),sort_order:Math.max(1,Math.trunc(Number(p.banner.order)||index+1)),options:{...p.banner,placement:'main',focus:'center',url:p.banner.url || `/mehsul/${String(p.seoSlug || `${p.id || 'mehsul'}-almaq`).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')}`}
    })).filter(p=>/^\/?(?:assets|uploads)\//.test(p.legacy_image) && !p.legacy_image.includes('..'));
    seed.push(...sideSeeds(catalog,Math.max(0,...seed.map(row=>row.sort_order))));
    check(await client.rpc('initialize_homepage_banners',{seed}));
  }
  function sideSeeds(catalog,start) {
    const youtube=(catalog.products || []).find(p=>p.id==='youtube' && p.active!==false);
    const support=catalog.cms?.supportCard;
    const presets=[
      youtube && {key:'youtube',image:youtube.banner?.desktopImage,title:youtube.banner?.alt || 'YouTube Premium',url:youtube.banner?.url || `/mehsul/${youtube.seoSlug || 'youtube'}`,mobileImage:youtube.banner?.mobileImage || ''},
      support?.enabled!==false && support?.desktopImage && {key:'support',image:support.desktopImage,title:support.alt || 'Canlı Dəstək',url:support.url || '/#elaqe',mobileImage:support.mobileImage || ''}
    ].filter(p=>p && legacyImage(p.image));
    return presets.map((p,index)=>{
      const hex=crypto.createHash('sha256').update(`mirpanel-hero-side-${p.key}-v1`).digest('hex');
      const id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
      return {id,legacy_image:p.image,title:p.title,sort_order:start+index+1,active:true,options:bannerOptions({placement:'side',focus:'center',url:p.url,mobileImage:p.mobileImage})};
    });
  }
  async function privateImage(path) {
      let cached = urls.get(path);
      if(!cached || cached.until<=now()) {
        const signed = check(await storage().createSignedUrl(path,7200));
        cached = {url:signed.signedUrl,until:now()+3600000}; urls.set(path,cached);
      }
      return cached.url;
  }
  async function present(row) {
    const image = row.media_path ? await privateImage(row.media_path) : new URL(row.legacy_image, 'https://mirpanel.com/').href;
    let mobileImage=legacyImage(row.options?.mobileImage);
    if(row.options?.mobileMediaPath?.startsWith('homepage-banners/')) {
      mobileImage=await privateImage(row.options.mobileMediaPath);
    } else if(mobileImage) mobileImage=new URL(mobileImage,'https://mirpanel.com/').href;
    let url=''; try {url=bannerLink(row.options?.url);} catch { /* do not render unsafe legacy links */ }
    return {id:row.id,image,mobileImage,title:row.title || 'Mirpanel ana səhifə banneri',url,newTab:row.options?.newTab===true,
      placement:row.options?.placement==='side'?'side':'main',focus:['left','right'].includes(row.options?.focus)?row.options.focus:'center',
      order:row.sort_order,active:row.active,version:row.updated_at};
  }
  async function list(admin=false) {
    if(admin) await initialize();
    if(!await managed()) return {managed:false,banners:[]};
    const data = (await rows()).filter(row=>admin || row.active);
    return {managed:true,banners:await Promise.all(data.map(present)),maxBytes:BANNER_IMAGE_MAX_BYTES};
  }
  async function cleanup(path) {
    if(!path?.startsWith('homepage-banners/')) return;
    const used = (await rows()).some(row=>row.media_path===path || row.options?.mobileMediaPath===path);
    if(!used) { check(await storage().remove([path])); urls.delete(path); }
  }
  async function begin(payload, owner) {
    await initialize();
    const key = String(payload.operationId || '');
    if(!uuid.test(key)) throw fail('Upload əməliyyatı düzgün deyil.');
    const size = Number(payload.size), ext = /\.(jpe?g|png|webp)$/i.exec(String(payload.fileName||''))?.[1]?.toLowerCase().replace('jpeg','jpg');
    if(!ext) throw fail('Yalnız JPG, PNG və WebP şəkli seçin.');
    if(!Number.isSafeInteger(size) || size<=0 || size>BANNER_IMAGE_MAX_BYTES) throw fail('Şəkil maksimum 20 MiB ola bilər.',413);
    const path = `homepage-banners/${key}.${ext}`;
    const role=payload.imageRole==='mobile'?'mobile':'desktop';
    if(role==='mobile' && !payload.targetId) throw fail('Əvvəl əsas banneri əlavə edin.');
    const options=bannerOptions(payload.options || {});
    const existing = (await rows()).find(row=>row.media_path===path || row.options?.mobileMediaPath===path);
    if(existing) return {completed:await present(existing)};
    const previous = pending.get(key);
    if(previous && (previous.owner!==owner || previous.size!==size || previous.path!==path || previous.targetId!==payload.targetId || previous.role!==role)) throw fail('Upload məlumatı dəyişib.',409);
    let target = null;
    if(payload.targetId) { target=await one(payload.targetId); if(!target) throw fail('Banner tapılmadı.',404); }
    const job = previous || {owner,size,path,ext,role,options,targetId:payload.targetId,targetVersion:target?.updated_at};
    job.until=now()+2*3600000; pending.set(key,job);
    if(!previous) {
      const timer=setTimeout(()=>{pending.delete(key); void cleanup(path).catch(()=>{});},2*3600000); timer.unref?.();
    }
    const signed = check(await storage().createSignedUploadUrl(path,{upsert:true}));
    return {operationId:key,signedUrl:signed.signedUrl};
  }
  async function complete(key, owner, options) {
    const job=pending.get(key);
    // Retry after a successful response was lost is safe even after a server restart.
    const committed = (await rows()).find(row=>row.media_path?.startsWith(`homepage-banners/${key}.`) || row.options?.mobileMediaPath?.startsWith(`homepage-banners/${key}.`));
    if(committed) return present(committed);
    if(!job || job.owner!==owner || job.until<=now()) throw fail('Upload müddəti bitib. Yenidən cəhd edin.',409);
    if(job.busy) throw fail('Şəkil yoxlanılır. Bir az sonra yenidən cəhd edin.',409);
    job.busy=true;
    try {
      const name=job.path.split('/').at(-1);
      const objects=check(await storage().list('homepage-banners',{search:name,limit:10}));
      const object=objects.find(item=>item.name===name);
      if(Number(object?.metadata?.size)!==job.size) throw fail('Şəkil storage-a tam yazılmayıb.',409);
      const blob=check(await storage().download(job.path));
      if(blob.size!==job.size || blob.size>BANNER_IMAGE_MAX_BYTES) throw fail('Şəkil ölçüsü düzgün deyil.',413);
      const format=detectStoryMedia(Buffer.from(await blob.arrayBuffer()));
      if(format?.kind!=='image' || format.extension!==job.ext) {await cleanup(job.path); throw fail('Şəkil zədələnib və ya formatı uyğun deyil.');}
      const old=job.targetId ? await one(job.targetId) : null;
      if(job.targetId && (!old || old.updated_at!==job.targetVersion)) {await cleanup(job.path); throw fail('Banner başqa pəncərədə dəyişib. Siyahını yeniləyin.',409);}
      const values={updated_at:new Date(now()).toISOString()};
      if(job.role==='mobile') values.options={...old.options,mobileMediaPath:job.path,mobileImage:''};
      else Object.assign(values,{media_path:job.path,legacy_image:null,options:bannerOptions(options || job.options,{placement:'main',focus:'center',...old?.options})});
      let saved;
      if(old) saved=check(await table().update(values).eq('id',old.id).eq('updated_at',old.updated_at).select('*').maybeSingle());
      else saved=check(await table().insert({...values,id:key,title:'',sort_order:Math.max(0,...(await rows()).map(r=>r.sort_order))+1,active:true}).select('*').single());
      if(!saved) throw fail('Banner dəyişib. Siyahını yeniləyin.',409);
      pending.delete(key);
      const oldPath=job.role==='mobile'?old?.options?.mobileMediaPath:old?.media_path;
      if(oldPath) await cleanup(oldPath).catch(()=>{});
      return present(saved);
    } finally {job.busy=false;}
  }
  async function update(id,payload) {
    if(!uuid.test(id)) throw fail('Banner tapılmadı.',404);
    const order=Number(payload.order);
    if(!Number.isSafeInteger(order)||order<1||order>100000 || typeof payload.active!=='boolean' || typeof payload.version!=='string') throw fail('Sıra və aktivlik düzgün deyil.');
    const values={sort_order:order,active:payload.active,updated_at:new Date(now()).toISOString()};
    const previous=await one(id); if(!previous) throw fail('Banner tapılmadı.',404);
    values.options=bannerOptions(payload,previous.options);
    const saved=check(await table().update(values).eq('id',id).eq('updated_at',payload.version).select('*').maybeSingle());
    if(!saved) throw fail('Banner başqa pəncərədə dəyişib. Siyahını yeniləyin.',409);
    if(previous.options?.mobileMediaPath && !saved.options?.mobileMediaPath) await cleanup(previous.options.mobileMediaPath).catch(()=>{});
    return present(saved);
  }
  async function reorder(items) {
    if(!Array.isArray(items) || !items.length || items.length>1000 || items.some(i=>!uuid.test(i.id) || typeof i.version!=='string') || new Set(items.map(i=>i.id)).size!==items.length) throw fail('Banner sırası düzgün deyil.');
    check(await client.rpc('reorder_homepage_banners',{items}));
    return list(true);
  }
  async function remove(id,version) {
    const deleted=check(await table().delete().eq('id',id).eq('updated_at',version).select('*').maybeSingle());
    if(!deleted) throw fail('Banner başqa pəncərədə dəyişib. Siyahını yeniləyin.',409);
    if(deleted.media_path) await cleanup(deleted.media_path).catch(()=>{});
    if(deleted.options?.mobileMediaPath) await cleanup(deleted.options.mobileMediaPath).catch(()=>{});
  }
  return {list,begin,complete,update,reorder,remove};
}
