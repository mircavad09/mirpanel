// Transactional authentication mail only. Never logs addresses, URLs or tokens.
const delivery=(message,deliveryDisposition,deliveryCode,retryAfterMs)=>Object.assign(Error(message),{deliveryDisposition,deliveryCode,retryAfterMs});
function retryAfter(response){const v=response.headers.get('Retry-After');return !v?0:/^\d+$/.test(v)?Number(v)*1000:Math.max(0,Date.parse(v)-Date.now())||0;}
export function createAuthMailer(env){let token=null,expires=0,pending;
 async function access(){if(token&&Date.now()<expires)return token;if(pending)return pending;
  pending=(async()=>{for(const k of ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN','GMAIL_SENDER_EMAIL'])if(!env[k])throw delivery('AUTH_MAIL_NOT_CONFIGURED','failed','AUTH_CONFIGURATION');
   let r;try{r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(12000)});}catch{throw delivery('AUTH_MAIL_AUTHORIZATION_FAILED','retry','TOKEN_TEMPORARY');}
   const v=await r.json().catch(()=>null);
   if(!r.ok||!v?.access_token){const temporary=r.ok||r.status===429||r.status>=500;throw delivery('AUTH_MAIL_AUTHORIZATION_FAILED',temporary?'retry':'failed',temporary?'TOKEN_TEMPORARY':'TOKEN_REJECTED',retryAfter(r));}
   token=v.access_token;expires=Date.now()+Math.max(0,(Number(v.expires_in)||300)-60)*1000;return token;})();try{return await pending;}finally{pending=null;}
 }
 return async(kind,{user,url,code,subject,textBody,htmlBody})=>{const origin=env.COMMUNITY_ORIGIN||'https://mirpanel.com';
  if(!['verify','reset','welcome','code','order'].includes(kind))throw Error('AUTH_MAIL_KIND_DENIED');
  const u=['verify','reset'].includes(kind)?new URL(url):null;if(u&&u.origin!==origin)throw Error('AUTH_MAIL_URL_DENIED');
  if(kind==='code'&&!/^\d{6}$/.test(code||''))throw Error('AUTH_MAIL_CODE_INVALID');
  const email=v=>{if(!/^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(v||''))throw delivery('AUTH_MAIL_ADDRESS_INVALID','failed','AUTH_CONFIGURATION');return v;};
  const durable=kind==='welcome'||kind==='order';
  const title=kind==='order'?subject:{verify:'MirPanel — e-poçtunuzu təsdiqləyin',reset:'MirPanel — şifrə bərpası',code:'MirPanel — e-poçt təsdiq kodu',welcome:'MirPanel-ə xoş gəlmisiniz!'}[kind];
  const text=kind==='order'?textBody:kind==='welcome'?'Salam!\n\nQeydiyyatınız uğurla tamamlandı. MirPanel-ə xoş gəlmisiniz! 🎉\n\nİlk sifarişinizi vermək üçün hesabınıza daxil olun, balansınızı artırın və bəyəndiyiniz məhsulu seçin.\n\nBalansımı artır: https://mirpanel.com/balans\nMəhsullara bax: https://mirpanel.com/\n\nSualınız olsa, saytdakı canlı dəstəkdən bizə yaza bilərsiniz.\n\nMirPanel komandası':(kind==='code'?'E-poçt təsdiq kodunuz: '+code+'\n\nKod 10 dəqiqə qüvvədədir.':(kind==='verify'?'E-poçtunuzu təsdiqləmək üçün bu keçidi açın:':'Şifrənizi yeniləmək üçün bu keçidi açın:')+'\n\n'+u.href)+'\n\nBu sorğunu siz etməmisinizsə, məktuba məhəl qoymayın.';
  const part=(type,body)=>['Content-Type: text/'+type+'; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(body).toString('base64').match(/.{1,76}/g).join('\r\n')];
  const boundary='mirpanel-welcome-alternative',html=kind==='order'?htmlBody:kind==='welcome'?text.replace('Balansımı artır: https://mirpanel.com/balans\nMəhsullara bax: https://mirpanel.com/','<a href="https://mirpanel.com/balans">Balansımı artır</a> · <a href="https://mirpanel.com/">Məhsullara bax</a>').split('\n\n').map(p=>'<p>'+p+'</p>').join(''):null;
  const senderName=kind==='code'?'"MirPanel"':'MirPanel';
  const raw=['From: '+senderName+' <'+email(env.GMAIL_SENDER_EMAIL)+'>','To: '+email(user.email),'Subject: =?UTF-8?B?'+Buffer.from(title).toString('base64')+'?=','MIME-Version: 1.0',...(html?['Content-Type: multipart/alternative; boundary="'+boundary+'"','','--'+boundary,...part('plain',text),'--'+boundary,...part('html',html),'--'+boundary+'--']:part('plain',text))].join('\r\n');
  const accessToken=await access();let r;
  try{r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw).toString('base64url')}),signal:AbortSignal.timeout(15000),...(durable?{redirect:'error'}:{})});}
  catch{throw delivery('AUTH_MAIL_DELIVERY_FAILED','uncertain','SEND_RESULT_UNKNOWN');}
  if(!durable){if(!r.ok)throw Error('AUTH_MAIL_DELIVERY_FAILED');return;}
  const result=await r.json().catch(()=>null);
  if(r.ok&&typeof result?.id==='string'&&result.id)return {id:result.id};
  // Retry only explicit provider rejections, not transport failures or 5xx.
  const limited=r.status===429||r.status===403&&result?.error?.errors?.some?.(e=>['rateLimitExceeded','userRateLimitExceeded'].includes(e.reason));
  if(limited)throw delivery('AUTH_MAIL_DELIVERY_FAILED','retry','SEND_RATE_LIMITED',retryAfter(r));
  if([400,401,403,404,413,422].includes(r.status))throw delivery('AUTH_MAIL_DELIVERY_FAILED','failed','SEND_REJECTED');
  throw delivery('AUTH_MAIL_DELIVERY_FAILED','uncertain','SEND_RESULT_UNKNOWN');
 };
}
