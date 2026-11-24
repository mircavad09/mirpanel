const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function paymentSelectionURL(ref,purpose){
 if(!uuid(ref))throw Error('Ödəniş istinadı düzgün deyil.');
 return (purpose==='purchase'?'/odenis':'/balans')+'?paymentReturn='+encodeURIComponent(ref);
}
