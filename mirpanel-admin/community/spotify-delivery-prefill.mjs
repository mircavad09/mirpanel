// Admin delivery preview only. Never use profile/contact data as account credentials.
const key=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('ə','e').replaceAll('ı','i').replace(/[^a-z0-9]/g,'');
const emailKeys=new Set(['email','mail','emailaddress','gmail','eposta','epoct','epoctunvaniniz','gmailunvaniniz','spotifyemail','spotifygmail','spotifyemailaddress','accountemail','customeremail','useremail','loginemail']);
const passwordKeys=new Set(['password','pass','passwd','parola','sifre','sifreniz','spotifyparola','spotifysifre','spotifysifreniz','spotifypass','spotifypassword','accountpassword','customerpassword','userpassword','loginpassword']);
const confirmation=value=>/confirm|repeat|tekrar|again/.test(key(value));
export function spotifyDeliveryPrefill(order,line,index,security){
 const snapshot=order.checkout_snapshot||{},item=snapshot.cartVersion===2?snapshot.items?.[index]:snapshot;
 if(!item)return null;
 const productId=item.productId||line.productId||order.product_id;
 const title=[line.title,line.planName,item.productName,item.planName].filter(Boolean).join(' ');
 if(productId!=='spotify'&&!(/spotify/i.test(title)&&/öz hesab|oz hesab|hesabınıza|hesabiniza|own account|your account/iu.test(title)))return null;
 if(/hazır|hazir|ready|ortaq|shared|yeni hesab|new account/iu.test(title))return null;
 if(!item.detailsCipher)return {email:'',password:''};
 let values;
 try{values=JSON.parse(security.decryptSecret(item.detailsCipher));}
 catch{throw Object.assign(Error('Sifarişin hesab məlumatları açıla bilmədi.'),{status:503});}
 if(!values||typeof values!=='object'||Array.isArray(values))return {email:'',password:''};
 const fields=Array.isArray(item.fields)?item.fields:[];
 const find=(type,aliases)=>{
  const entries=Object.entries(values).filter(([name,value])=>typeof value==='string'&&!confirmation(name));
  const typed=entries.find(([name])=>fields.some(f=>f.key===name&&f.type===type&&!f.privateConfirmation&&!confirmation(f.label)));
  const known=entries.find(([name])=>aliases.has(key(name)));
  const labelled=entries.find(([name])=>fields.some(f=>f.key===name&&!confirmation(f.label)&&aliases.has(key(f.label))));
  return (typed||known||labelled)?.[1]||'';
 };
 return {email:find('email',emailKeys),password:find('password',passwordKeys)};
}
