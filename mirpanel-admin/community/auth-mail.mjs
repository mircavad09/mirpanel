// Transactional authentication mail only. Never logs addresses, URLs or tokens.
export function createAuthMailer(env){let token=null,expires=0,pending;
 async function access(){if(token&&Date.now()<expires)return token;if(pending)return pending;
  pending=(async()=>{for(const k of ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN','GMAIL_SENDER_EMAIL'])if(!env[k])throw Error('AUTH_MAIL_NOT_CONFIGURED');
   const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(12000)});const v=await r.json();if(!r.ok||!v.access_token)throw Error('AUTH_MAIL_AUTHORIZATION_FAILED');token=v.access_token;expires=Date.now()+Math.max(0,(Number(v.expires_in)||300)-60)*1000;return token;})();try{return await pending;}finally{pending=null;}
 }
 return async(kind,{user,url})=>{const origin=env.COMMUNITY_ORIGIN||'https://mirpanel.com',u=new URL(url);if(u.origin!==origin||!['verify','reset'].includes(kind))throw Error('AUTH_MAIL_URL_DENIED');
  const email=v=>{if(!/^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(v||''))throw Error('AUTH_MAIL_ADDRESS_INVALID');return v;};
  const title=kind==='verify'?'MirPanel — e-poçtunuzu təsdiqləyin':'MirPanel — şifrə bərpası';
  const text=(kind==='verify'?'E-poçtunuzu təsdiqləmək üçün bu keçidi açın:':'Şifrənizi yeniləmək üçün bu keçidi açın:')+'\n\n'+u.href+'\n\nBu sorğunu siz etməmisinizsə, məktuba məhəl qoymayın.';
  const raw=['From: MirPanel <'+email(env.GMAIL_SENDER_EMAIL)+'>','To: '+email(user.email),'Subject: =?UTF-8?B?'+Buffer.from(title).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n');
  const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+await access(),'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw).toString('base64url')}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('AUTH_MAIL_DELIVERY_FAILED');
 };
}
