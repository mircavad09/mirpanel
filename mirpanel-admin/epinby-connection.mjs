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
  return async function epinby(input={action:'epinby-read'}){
    const db=await pool();
    if(input.action==='epinby-read')return projection(await read(db));
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
