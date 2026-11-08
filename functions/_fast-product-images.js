// Negotiated delivery variants: keep catalog URLs and source files unchanged.
const names=new Set([
 'adobe_express-1793128277159-ed1498a1.png',
 'adobecc-1792450954538-64c5979f.png',
 'canva-1792448677882-81e67e07.png',
 'capcut-1792446915889-2c0554fd.png',
 'captions-1792448708784-7d662bbc.png',
 'chatgpt_ortaq-1793127941676-a7cb0a6a.png',
 'chatgpt-1792447571091-e78cfb71.png',
 'claude_ai-1792448422631-a0521937.png',
 'duolingo-1792448623830-b79e0ac4.png',
 'elevenlabs_creator-1793128505997-2ea31cf7.png',
 'google_ai_ultra-1793128040365-716704a3.png',
 'google_ai-1792447643071-a8ab5d26.png',
 'grok_supergrok-1792448632619-5d302a16.png',
 'hbomax-1792448430771-91c8a1ec.png',
 'linkedin_career-1793128270752-744fc34c.png',
 'netflix_sexsi-1792448690453-b2c32429.png',
 'netflix_umumi-1792446909068-646ca735.png',
 'netflix-1792446904161-56cd3ef4.png',
 'notion_plus-1793128335750-5e44b2d1.png',
 'picsart_premium-1793128536130-84c3b402.png',
 'prime-1792446922093-1fb61bd1.png',
 'spotify-1792446476574-ac5a1948.png',
 'surfshark-1792448333121-dcfb98b1.png',
 'tiktok_jeton-1792448326473-7df012e5.png',
 'youtube_sexsi-1792448126347-307ca913.png',
 'youtube-1792448135653-d84f34dc.png',
 'zoom-1793128113656-08a17411.png'
]);
export async function fastProductImage(context,url){
 const prefix='/uploads/products/';
 if(!url.pathname.startsWith(prefix)||!names.has(url.pathname.slice(prefix.length)))return null;
 const {request}=context;
 if(!['GET','HEAD'].includes(request.method)||request.headers.has('Range'))return null;
 const acceptsWebp=(request.headers.get('Accept')||'').split(',').some(part=>{
  const [type,...params]=part.trim().toLowerCase().split(';');return type.trim()==='image/webp'&&!params.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));
 });
 let response;
 if(acceptsWebp){
  const variant=new URL(url);variant.pathname=variant.pathname.replace(/\.png$/,'.perf.webp');
  response=await context.next(new Request(variant,request));
  if(![200,304].includes(response.status))response=null;
 }
 response??=await context.next();
 const headers=new Headers(response.headers);headers.append('Vary','Accept');
 return new Response(response.body,{status:response.status,headers});
}
