// Delivery estimates describe evidence, never the manually configured sale limit.
export function readyDeliveryText(fulfillment,canOrder){
 if(!fulfillment)return null;
 if(canOrder===false)return 'Stokda yoxdur';
 if(fulfillment.automatic&&fulfillment.ready>0)return 'Anında təqdim olunur';
 if(fulfillment.ready===0&&fulfillment.allowWaiting)return '15–30 dəqiqə ərzində tamamlanır';
 return 'Ödəniş təsdiqindən sonra təqdim olunur';
}
