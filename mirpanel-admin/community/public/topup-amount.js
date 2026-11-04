// Shared customer top-up policy; admin ledger adjustments keep their own policy.
export function parseTopupCents(value){
 if(typeof value!=='string'||value.length>32||!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))throw Object.assign(Error('Məbləği ən çox iki qəpik rəqəmi ilə yazın.'),{status:400});
 const [whole,fraction='']=value.trim().replace(',','.').split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<100||cents>50000)throw Object.assign(Error('Məbləğ minimum 1 ₼, maksimum 500 ₼ olmalıdır.'),{status:400});
 return cents;
}
export const topupAmountText=cents=>Math.floor(cents/100)+'.'+String(cents%100).padStart(2,'0');
