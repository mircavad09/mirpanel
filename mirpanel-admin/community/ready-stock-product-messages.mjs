const table='mirpanel_community.ready_stock_product_messages';

export async function readProductMessages(db,security,productIds){
 if(!productIds.length)return new Map();
 const {rows}=await db.query('select product_id,message_cipher from '+table+' where product_id=any($1::text[])',[productIds]);
 return new Map(rows.map(row=>{
  const value=JSON.parse(security.decryptSecret(row.message_cipher));
  if(value.productId!==row.product_id||typeof value.message!=='string')throw Error('READY_STOCK_MESSAGE_REFERENCE_MISMATCH');
  return [row.product_id,value.message];
 }));
}

export async function saveProductMessage(db,security,catalog,{productId,message}={}){
 if(typeof message!=='string'||!message.trim()||message.length>8000||!catalog.products.some(p=>p.id===productId)){
  throw Object.assign(Error('Məhsulu seçin və hazır mesajı yazın.'),{status:400});
 }
 const cipher=security.encryptSecret(JSON.stringify({productId,message}));
 await db.query('insert into '+table+' (product_id,message_cipher) values($1,$2) on conflict(product_id) do update set message_cipher=excluded.message_cipher',[productId,cipher]);
 return {message};
}
