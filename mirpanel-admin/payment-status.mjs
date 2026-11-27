// Customer attempt outcome is distinct from the unresolved financial result.
// Never infer abandonment from age, a transport error or record-not-found.
export function paymentStatus({paid=false,status,code,declined=false,abandoned=false}={}){
 if(paid)return 'success';
 if(abandoned)return 'failed';
 if(['failed','error','returned'].includes(status)||declined)return ['180','canceled','cancelled'].includes(String(code))?'cancelled':'failed';
 return 'pending';
}
export const paymentStatusLabel={success:'Uğurlu',failed:'Uğursuz',cancelled:'Ləğv edildi',pending:'Gözləyir'};
