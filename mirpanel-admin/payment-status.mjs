export function paymentStatus({paid=false,status,code,declined=false}={}){
 if(paid)return 'success';
 if(['failed','error','returned'].includes(status)||declined)return ['180','canceled','cancelled'].includes(String(code))?'cancelled':'failed';
 return 'pending';
}
export const paymentStatusLabel={success:'Uğurlu',failed:'Uğursuz',cancelled:'Ləğv edildi',pending:'Gözləyir'};
