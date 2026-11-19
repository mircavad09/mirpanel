// Provider creation acknowledgements are not payment confirmations.
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
export function inspectWalletOpening(answer){
 const transaction=ref(answer?.transaction)?answer.transaction:null;
 const trace=ref(answer?.trace_id)?answer.trace_id:null;
 const url=typeof answer?.redirect_url==='string'?answer.redirect_url:null;
 let issue=null;
 if(!transaction)issue='missing_transaction';
 else if(!url)issue='missing_redirect_url';
 else{
  try{
   const parsed=new URL(url);
   // Birbank currently wraps a bank rejection in a navigable Epoint URL.
   if(parsed.hostname==='epoint.az'&&parsed.pathname==='/wallet/pay-with-wallet/bir_bank'){
    const payload=parsed.searchParams.get('payload');
    if(payload){
     const bank=JSON.parse(Buffer.from(payload,'base64').toString('utf8'));
     if(Number(bank.status)>=400||bank.code==='invalid_policy')issue='provider_rejected_redirect';
    }
   }
  }catch{issue='invalid_redirect_url';}
 }
 if(answer?.status!=null&&answer.status!=='success')issue='provider_rejected';
 return {transaction,trace,issue,url,ready:!issue};
}
