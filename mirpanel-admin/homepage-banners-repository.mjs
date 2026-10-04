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
export function createHomepageBannersRepository(client, {bucket, loadCatalog, now = () => Date.now()} = {}) {
  const table = () => client.from('homepage_banners');
  const storage = () => client.storage.from(bucket);
  const pending = new Map(), urls = new Map();
  async function rows() { return check(await table().select('*').order('sort_order').order('id')) || []; }
  async function one(id) { return check(await table().select('*').eq('id',id).maybeSingle()); }
  async function managed() { return Boolean(check(await client.from('homepage_banner_settings').select('initialized').eq('singleton',true).single())?.initialized); }
  async function initialize() {
    if(await managed()) return;
    const catalog = await loadCatalog();
    const seed = (catalog.products || []).filter(p=>p.active!==false && p.banner?.enabled===true).map((p,index)=>({
      id:crypto.randomUUID(),legacy_image:String(p.banner.desktopImage || p.image || ''),title:String(p.banner.alt || p.title || 'Mirpanel ana səhifə banneri').slice(0,200),sort_order:Math.max(1,Math.trunc(Number(p.banner.order)||index+1)),options:{...p.banner,url:p.banner.url || `/mehsul/${String(p.seoSlug || `${p.id || 'mehsul'}-almaq`).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')}`}
    })).filter(p=>/^\/?(?:assets|uploads)\//.test(p.legacy_image) && !p.legacy_image.includes('..'));
    check(await client.rpc('initialize_homepage_banners',{seed}));
  }
  async function present(row) {
    let image = row.legacy_image;
    if(row.media_path) {
      let cached = urls.get(row.media_path);
      if(!cached || cached.until<=now()) {
        const signed = check(await storage().createSignedUrl(row.media_path,7200));
        cached = {url:signed.signedUrl,until:now()+3600000}; urls.set(row.media_path,cached);
      }
      image = cached.url;
    } else image = new URL(image, 'https://mirpanel.com/').href;
    const href=String(row.options?.url || '');
    const url=/^(https:\/\/|\/(?!\/))/.test(href) ? href : '';
    return {id:row.id,image,title:row.title || 'Mirpanel ana səhifə banneri',url,newTab:row.options?.newTab===true,order:row.sort_order,active:row.active,version:row.updated_at};
  }
  async function list(admin=false) {
    if(admin) await initialize();
    if(!await managed()) return {managed:false,banners:[]};
    const data = (await rows()).filter(row=>admin || row.active);
    return {managed:true,banners:await Promise.all(data.map(present)),maxBytes:BANNER_IMAGE_MAX_BYTES};
  }
  async function cleanup(path) {
    if(!path?.startsWith('homepage-banners/')) return;
    const used = check(await table().select('id').eq('media_path',path));
    if(!used?.length) { check(await storage().remove([path])); urls.delete(path); }
  }
  async function begin(payload, owner) {
    await initialize();
    const key = String(payload.operationId || '');
    if(!uuid.test(key)) throw fail('Upload əməliyyatı düzgün deyil.');
    const size = Number(payload.size), ext = /\.(jpe?g|png|webp)$/i.exec(String(payload.fileName||''))?.[1]?.toLowerCase().replace('jpeg','jpg');
    if(!ext) throw fail('Yalnız JPG, PNG və WebP şəkli seçin.');
    if(!Number.isSafeInteger(size) || size<=0 || size>BANNER_IMAGE_MAX_BYTES) throw fail('Şəkil maksimum 20 MiB ola bilər.',413);
    const path = `homepage-banners/${key}.${ext}`;
    const existing = check(await table().select('*').eq('media_path',path).maybeSingle());
    if(existing) return {completed:await present(existing)};
    const previous = pending.get(key);
    if(previous && (previous.owner!==owner || previous.size!==size || previous.path!==path || previous.targetId!==payload.targetId)) throw fail('Upload məlumatı dəyişib.',409);
    let target = null;
    if(payload.targetId) { target=await one(payload.targetId); if(!target) throw fail('Banner tapılmadı.',404); }
    const job = previous || {owner,size,path,ext,targetId:payload.targetId,targetVersion:target?.updated_at};
    job.until=now()+2*3600000; pending.set(key,job);
    if(!previous) {
      const timer=setTimeout(()=>{pending.delete(key); void cleanup(path).catch(()=>{});},2*3600000); timer.unref?.();
    }
    const signed = check(await storage().createSignedUploadUrl(path,{upsert:true}));
    return {operationId:key,signedUrl:signed.signedUrl};
  }
  async function complete(key, owner) {
    const job=pending.get(key);
    // Retry after a successful response was lost is safe even after a server restart.
    const committed = (await rows()).find(row=>row.media_path?.startsWith(`homepage-banners/${key}.`));
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
      const values={media_path:job.path,legacy_image:null,updated_at:new Date(now()).toISOString()};
      let saved;
      if(old) saved=check(await table().update(values).eq('id',old.id).eq('updated_at',old.updated_at).select('*').maybeSingle());
      else saved=check(await table().insert({...values,id:key,title:'',sort_order:Math.max(0,...(await rows()).map(r=>r.sort_order))+1,active:true}).select('*').single());
      if(!saved) throw fail('Banner dəyişib. Siyahını yeniləyin.',409);
      pending.delete(key);
      if(old?.media_path) await cleanup(old.media_path).catch(()=>{});
      return present(saved);
    } finally {job.busy=false;}
  }
  async function update(id,payload) {
    if(!uuid.test(id)) throw fail('Banner tapılmadı.',404);
    const order=Number(payload.order);
    if(!Number.isSafeInteger(order)||order<1||order>100000 || typeof payload.active!=='boolean' || typeof payload.version!=='string') throw fail('Sıra və aktivlik düzgün deyil.');
    const values={sort_order:order,active:payload.active,updated_at:new Date(now()).toISOString()};
    if(payload.url!==undefined) {
      if(typeof payload.url!=='string' || (payload.url && !/^(https:\/\/|\/(?!\/))/.test(payload.url)) || payload.url.length>2000) throw fail('Keçid üçün HTTPS ünvanı və ya sayt daxilində yol yazın.');
      const previous=await one(id); if(!previous) throw fail('Banner tapılmadı.',404);
      values.options={...previous.options,url:payload.url};
    }
    const saved=check(await table().update(values).eq('id',id).eq('updated_at',payload.version).select('*').maybeSingle());
    if(!saved) throw fail('Banner başqa pəncərədə dəyişib. Siyahını yeniləyin.',409);
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
  }
  return {list,begin,complete,update,reorder,remove};
}
