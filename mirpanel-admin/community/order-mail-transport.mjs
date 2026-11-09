const fail=(deliveryDisposition,deliveryCode,retryAfterMs=0)=>Object.assign(new Error(deliveryCode),{deliveryDisposition,deliveryCode,retryAfterMs});
const domainSender=/^[a-z0-9][a-z0-9._+\-]*@mirpanel\.com$/i;
const recipient=/^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/;

export function createOrderMailTransport(env,defaultSend,{fetcher=fetch}={}){
  if(!env.ORDER_MAIL_PROVIDER)return defaultSend;
  const from=env.ORDER_MAIL_FROM;
  const key=env.ORDER_MAIL_RESEND_API_KEY;
  return async(kind,message)=>{
    if(kind!=='order')throw new Error('ORDER_MAIL_KIND_DENIED');
    if(env.ORDER_MAIL_PROVIDER!=='resend'||!domainSender.test(from||'')||!key||!recipient.test(message.user?.email||''))throw fail('failed','AUTH_CONFIGURATION');
    let response;
    try{
      response=await fetcher('https://api.resend.com/emails',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(message.idempotencyKey?{'Idempotency-Key':message.idempotencyKey}:{})},
        body:JSON.stringify({from:`MirPanel <${from}>`,to:[message.user.email],subject:message.subject,text:message.textBody,html:message.htmlBody,attachments:message.attachments}),
      });
    }catch{throw fail('uncertain','SEND_RESULT_UNKNOWN');}
    const result=await response.json().catch(()=>null);
    if(response.ok&&typeof result?.id==='string'&&result.id)return {id:result.id};
    if(response.status===429){
      const after=response.headers.get('Retry-After');
      const delay=after&&/^\d+$/.test(after)?Number(after)*1000:Math.max(0,Date.parse(after)-Date.now())||0;
      throw fail('retry','SEND_RATE_LIMITED',delay);
    }
    if([400,401,403,404,413,422].includes(response.status))throw fail('failed','SEND_REJECTED');
    // Do not switch providers or replay a submission whose acceptance is unknown.
    throw fail('uncertain','SEND_RESULT_UNKNOWN');
  };
}
