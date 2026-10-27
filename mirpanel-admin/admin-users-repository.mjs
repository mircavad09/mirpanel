// Read-only production account directory. No community tables, test imports,
// Auth mutations, role grants, tier calculations or customer registration.
const fail=(status,code,message)=>Object.assign(Error(message),{status,code});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text=(v,max=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
export function publicAccount(u,now=Date.now()){
 if(!u||!uuid(u.id))throw fail(503,'USER_DIRECTORY_INVALID','İstifadəçi xidməti düzgün cavab vermədi.');
 const m=u.user_metadata||{},parts=[text(m.first_name,60),text(m.last_name,60)].filter(Boolean),providers=[...new Set((u.identities?.map(i=>i.provider)||u.app_metadata?.providers||[u.app_metadata?.provider]).filter(p=>typeof p==='string'))];
 const email=text(u.email,254)||null,phone=text(u.phone,40)||null,emailVerified=Boolean(date(u.email_confirmed_at)),phoneVerified=Boolean(date(u.phone_confirmed_at));
 return{id:u.id,name:parts.join(' ')||text(m.full_name)||text(m.name)||text(m.display_name)||'Göstərilməyib',email,phone,emailVerified,phoneVerified,createdAt:date(u.created_at),accountState:Date.parse(u.banned_until)>now?'Bloklanıb':email&&!emailVerified?'E-poçt təsdiqi gözləyir':!email&&phone&&!phoneVerified?'Telefon təsdiqi gözləyir':'Aktiv',signInMethods:providers.map(p=>p==='google'?'Google':p==='email'?'E-poçt və şifrə':p==='phone'?'Telefon':'Digər')};
}
export function createAdminUsersRepository(client,{cacheMs=5000,maxUsers=10000,now=()=>Date.now()}={}){
 let snapshot=null,expires=0,pending=null;
 function admin(){if(!client?.auth?.admin)throw fail(503,'USER_DIRECTORY_UNAVAILABLE','İstifadəçi xidməti hazırda əlçatan deyil.');return client.auth.admin;}
 async function load(){
  if(snapshot&&expires>now())return snapshot;if(pending)return pending;
  pending=(async()=>{const found=new Map(),perPage=500;
   for(let page=1;page<=Math.ceil(maxUsers/perPage);page++){
    let result;try{result=await admin().listUsers({page,perPage});}catch{throw fail(503,'USER_DIRECTORY_UNAVAILABLE','İstifadəçilər yüklənmədi. Yenidən cəhd edin.');}
    if(result.error||!Array.isArray(result.data?.users))throw fail(503,'USER_DIRECTORY_UNAVAILABLE','İstifadəçilər yüklənmədi. Yenidən cəhd edin.');
    const rows=result.data.users;if(rows.length>perPage)throw fail(503,'USER_DIRECTORY_INVALID','İstifadəçi xidməti düzgün cavab vermədi.');
    for(const u of rows){if(found.has(u.id))throw fail(503,'USER_DIRECTORY_CHANGED','Siyahı yeniləndi. Yenidən cəhd edin.');found.set(u.id,u.is_anonymous===true?null:publicAccount(u,now()));}
    if(found.size>maxUsers)break;
    const total=Number(result.data.total);
    if(rows.length<perPage||(total>0&&found.size>=total)){
     snapshot=[...found.values()].filter(Boolean).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||b.id.localeCompare(a.id));expires=now()+cacheMs;return snapshot;
    }
   }
   throw fail(503,'USER_DIRECTORY_SCAN_LIMIT','İstifadəçi siyahısı hazırda tam yüklənmədi. Yenidən cəhd edin.');
  })();try{return await pending;}finally{pending=null;}
 }
 return{
  async list({q='',page='1',limit='20'}={}){
   if(typeof q!=='string'||q.length>100||!/^\d+$/.test(String(page))||!/^\d+$/.test(String(limit)))throw fail(400,'INVALID_USER_QUERY','Axtarış və səhifə parametrləri düzgün deyil.');
   const n=Number(page),size=Number(limit);if(n<1||n>10000||size<1||size>50)throw fail(400,'INVALID_USER_QUERY','Səhifə ölçüsü düzgün deyil.');
   const search=q.trim(),plain=search.toLowerCase(),az=search.toLocaleLowerCase('az-AZ'),rows=(await load()).filter(u=>!search||[u.id,u.email||''].some(v=>v.toLowerCase().includes(plain))||u.name.toLocaleLowerCase('az-AZ').includes(az)),start=(n-1)*size;
   return{users:rows.slice(start,start+size),total:rows.length,page:n,pageSize:size,hasMore:start+size<rows.length};
  },
  async detail(id){
   if(!uuid(id))throw fail(400,'INVALID_USER_ID','İstifadəçi ID-si düzgün deyil.');let r;
   try{r=await admin().getUserById(id);}catch{throw fail(503,'USER_DIRECTORY_UNAVAILABLE','İstifadəçi yüklənmədi. Yenidən cəhd edin.');}
   if(r.error){if(r.error.status===404||r.error.code==='user_not_found')throw fail(404,'USER_NOT_FOUND','İstifadəçi tapılmadı.');throw fail(503,'USER_DIRECTORY_UNAVAILABLE','İstifadəçi yüklənmədi. Yenidən cəhd edin.');}
   if(!r.data?.user||r.data.user.is_anonymous===true)throw fail(404,'USER_NOT_FOUND','İstifadəçi tapılmadı.');
   return{user:publicAccount(r.data.user,now())};
  }
 };
}
