import {supplierRequest} from './supplier-request.mjs';

const table='mirpanel_community.epinby_connection';
export const epinbyMessages={
  confirmed:'Bağlantı təsdiqləndi',
  invalid_key:'Epinby API açarını qəbul etmədi.',
  network_error:'Epinby ilə bağlantı qurulmadı. Şəbəkə xətası.',
  timeout:'Epinby vaxtında cavab vermədi. Yenidən yoxlayın.',
  invalid_response:'Epinby gözlənilən formatda cavab vermədi.',
  unavailable:'Epinby xidməti hazırda əlçatan deyil.',
  unconfigured:'Əvvəl X-API-Key daxil edib yadda saxlayın.',
  changed:'Açar yoxlama zamanı dəyişdi. Yenidən yoxlayın.'
};
const validSecret=value=>typeof value==='string'&&value.length<=2048&&!/[\x00-\x20\x7f-\uffff]/.test(value);
const bad=()=>Object.assign(Error('Açar formatı düzgün deyil.'),{status:400});
function projection(row){
  return {
    baseUrl:'https://epinby.com/api/v1',
    apiKeySaved:!!row?.api_key_cipher,webhookSecretSaved:!!row?.webhook_secret_cipher,
    lastAttemptAt:row?.last_attempt_at||null,lastAttemptStatus:row?.last_attempt_status||null,
    lastCheckedAt:row?.last_checked_at||null,lastStatus:row?.last_status||null,
    balance:row?.balance??null,currency:row?.currency||null
  };
}
export function createEpinbyConnection({pool,security,transport=supplierRequest}){
  const read=async db=>(await db.query('select * from '+table+' where id=true')).rows[0];
  const catalogFlights=new Map();
  const catalogText=value=>typeof value==='string'?value.trim().slice(0,240):'';
  function catalogImage(value){
    if(typeof value!=='string'||!value||value.length>2000)return null;
    try{const url=new URL(value,'https://epinby.com');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
  }
  async function catalog(db,row,input){
    const connection=projection(row);
    if(!row?.api_key_cipher||row.last_status!=='confirmed')return {connection,products:[]};
    const version=row.credential_version, gamesOnly=input.gamesOnly===true;
    const page=Math.max(1,Math.min(10000,Number(input.page)||1));
    const query={page,per_page:50};
    for(const [key,value] of [['game_id',input.gameId],['category_id',input.categoryId]])if(Number(value)>0)query[key]=Number(value);
    const flightKey=JSON.stringify([version,gamesOnly,query]);
    if(catalogFlights.has(flightKey))return catalogFlights.get(flightKey);
    const flight={};
    flight.promise=(async()=>{
      try{
        const key=security.decryptSecret(row.api_key_cipher), products=new Map();
        const options={base:'https://epinby.com',allowlist:new Set(['https://epinby.com']),key,authHeader:'X-API-Key',jsonResponse:true};
        const gamesResponse=gamesOnly?await transport({...options,path:'/api/v1/games'}):{success:true,data:[]};
        if(gamesResponse?.success!==true||!Array.isArray(gamesResponse.data))throw Error('CATALOG_FORMAT');
        const games=gamesResponse.data.filter(g=>Number.isSafeInteger(Number(g.id))&&Number(g.id)>0&&catalogText(g.name))
          .map(g=>({id:Number(g.id),name:catalogText(g.name),image:catalogImage(g.image)}));
        if(gamesOnly)return {connection,games,products:[]};
        {
          const response=await transport({base:'https://epinby.com',path:'/api/v1/products',query,
            allowlist:new Set(['https://epinby.com']),key,authHeader:'X-API-Key',jsonResponse:true,maxResponseBytes:524288});
          const last=Number(response?.meta?.last_page);
          if(response?.success!==true||!Array.isArray(response.data)||Number(response.meta?.current_page)!==page||!Number.isSafeInteger(last)||last<0)throw Error('CATALOG_FORMAT');
          for(const item of response.data){
            const id=Number(item?.id), name=catalogText(item?.name), price=String(item?.price??'');
            if(!Number.isSafeInteger(id)||id<1||!name||!/^\d{1,15}(?:\.\d{1,8})?$/.test(price))throw Error('CATALOG_FORMAT');
            products.set(id,{id,name,game:catalogText(item.game),category:catalogText(item.category),
              package:catalogText(item.package_name||item.package),image:catalogImage(item.image||item.image_url),price,
              type:catalogText(item.type).toUpperCase(),fields:Array.isArray(item.fields)?item.fields:[],
              gameId:Number(item.game_id)||null,categoryId:Number(item.category_id)||null,
              stockStatus:catalogText(item.stock_status).toUpperCase(),
              stockCount:item.stock_count!=null&&Number.isSafeInteger(Number(item.stock_count))&&Number(item.stock_count)>=0?Number(item.stock_count):null});
          }
            const current=await read(db);
            if(current?.credential_version!==version||current?.last_status!=='confirmed')return {connection:projection(current),products:[]};
            return {connection,products:[...products.values()],meta:{page,lastPage:last,total:Number(response.meta.total),perPage:50},complete:page>=last};
        }
      }catch(error){
        return {connection,products:[],error:[401,403].includes(error.supplierStatus)
          ?'Epinby açarı qəbul etmədi. API inteqrasiyalarında bağlantını yoxlayın.'
          :'Epinby kataloqu alınmadı. Yenidən cəhd edin.'};
      }finally{catalogFlights.delete(flightKey);}
    })();
    catalogFlights.set(flightKey,flight.promise);
    return flight.promise;
  }
  return async function epinby(input={action:'epinby-read'}){
    const db=await pool();
    if(input.action==='epinby-read')return projection(await read(db));
    if(input.action==='epinby-catalog')return catalog(db,await read(db),input);
    if(input.action==='epinby-categories'){
      const row=await read(db), gameId=Number(input.gameId);
      if(!Number.isSafeInteger(gameId)||gameId<1)throw bad();
      if(!row?.api_key_cipher||row.last_status!=='confirmed')return {categories:[]};
      try{
        const result=await transport({base:'https://epinby.com',path:'/api/v1/categories',query:{game_id:gameId},
          allowlist:new Set(['https://epinby.com']),key:security.decryptSecret(row.api_key_cipher),authHeader:'X-API-Key',jsonResponse:true});
        if(result?.success!==true||!Array.isArray(result.data))throw Error();
        const current=await read(db);
        if(current?.credential_version!==row.credential_version)throw Error();
        return {categories:result.data.filter(c=>catalogText(c.name)).map(c=>({id:Number(c.id),name:catalogText(c.name),image:catalogImage(c.image)}))};
      }catch{return {categories:[],error:'Kateqoriyalar alınmadı. Yenidən cəhd edin.'};}
    }
    if(input.action==='epinby-save'){
      const {apiKey='',webhookSecret=''}=input;
      if(!validSecret(apiKey)||!validSecret(webhookSecret))throw bad();
      const keyCipher=apiKey?security.encryptSecret(apiKey):null;
      const webhookCipher=webhookSecret?security.encryptSecret(webhookSecret):null;
      const row=(await db.query(`update ${table} set
        api_key_cipher=coalesce($1,api_key_cipher),webhook_secret_cipher=coalesce($2,webhook_secret_cipher),
        credential_version=credential_version+case when $1::text is not null then 1 else 0 end,
        last_status=case when $1::text is not null then null else last_status end,
        last_checked_at=case when $1::text is not null then null else last_checked_at end,
        last_attempt_at=case when $1::text is not null then null else last_attempt_at end,
        last_attempt_status=case when $1::text is not null then null else last_attempt_status end,
        balance=case when $1::text is not null then null else balance end,
        currency=case when $1::text is not null then null else currency end where id=true returning *`,
      [keyCipher,webhookCipher])).rows[0];
      return projection(row);
    }
    if(input.action!=='epinby-test')throw bad();
    const row=await read(db);
    if(!row?.api_key_cipher)return {...projection(row),result:'unconfigured',message:epinbyMessages.unconfigured};
    const attemptedAt=new Date().toISOString();
    let result, balance=null, currency=null;
    try{
      const response=await transport({base:'https://epinby.com',path:'/api/v1/getMe',
        allowlist:new Set(['https://epinby.com']),key:security.decryptSecret(row.api_key_cipher),
        authHeader:'X-API-Key',jsonResponse:true});
      if(response?.success===true&&
         /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/.test(String(response.data?.balance))&&
         typeof response.data?.currency==='string'&&/^[A-Z]{3,8}$/.test(response.data.currency)){
        result='confirmed';balance=String(response.data.balance);currency=response.data.currency;
      }else result='invalid_response';
    }catch(error){
      result=[401,403].includes(error.supplierStatus)?'invalid_key'
        :error.supplierStatus?'unavailable'
        :['ABORT_ERR','ETIMEDOUT'].includes(error.code)||error.name==='TimeoutError'?'timeout'
        :error.message==='SUPPLIER_JSON'?'invalid_response':'network_error';
    }
    const definitive=['confirmed','invalid_key'].includes(result);
    const saved=await db.query(`update ${table} set last_attempt_at=$2,last_attempt_status=$3,
      last_checked_at=case when $4 then $2::timestamptz else last_checked_at end,
      last_status=case when $4 then $3 else last_status end,
      balance=case when $3='confirmed' then $5 else balance end,
      currency=case when $3='confirmed' then $6 else currency end
      where id=true and credential_version=$1
        and (last_attempt_at is null or last_attempt_at<=$2::timestamptz) returning *`,
    [row.credential_version,attemptedAt,result,definitive,balance,currency]);
    if(!saved.rowCount)return {...projection(await read(db)),result:'changed',message:epinbyMessages.changed};
    return {...projection(saved.rows[0]),result,message:epinbyMessages[result]};
  };
}
