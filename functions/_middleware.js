const STATIC_ASSET_RE = /\.(?:js|css|png|jpe?g|webp|svg|ico|gif|avif|xml|txt|json|map|woff2?|ttf|eot|pdf)$/i;

const BASE_URL = "https://mirpanel.com";
const DEFAULT_IMAGE = `${BASE_URL}/assets/logo.png`;

const MARKDOWN = `---
title: Mirpanel
description: Premium hesablar vЙ™ etibarlД± aktivlЙ™ЕџdirmЙ™ xidmЙ™ti.
url: https://mirpanel.com/
---

# Mirpanel

Mirpanel premium hesablar vЙ™ rЙ™qЙ™msal xidmЙ™tlЙ™r ГјГ§Гјn public saytД±dД±r. Saytda mЙ™hsullar, qiymЙ™tlЙ™r, stok statusu vЙ™ sifariЕџ dГјymЙ™lЙ™ri gГ¶stЙ™rilir. Brauzer istifadЙ™Г§ilЙ™ri ГјГ§Гјn normal HTML sayt Й™sas cavab olaraq qalД±r.

## ЖЏsas Menyu

- Ana SЙ™hifЙ™
- MЙ™hsullar
- HaqqД±mД±zda
- ЕћЙ™rtlЙ™r
- ЖЏlaqЙ™

## MЙ™hsullar HaqqД±nda

Mirpanel-dЙ™ Netflix, Spotify, YouTube Premium, CapCut Pro, Zoom Pro, HBO Max, Amazon Prime Video vЙ™ digЙ™r premium hesab vЙ™ xidmЙ™tlЙ™r tЙ™qdim olunur. MЙ™hsul kartlarД±nda ad, kateqoriya, qiymЙ™t vЙ™ varsa stok statusu gГ¶stЙ™rilir.

## AxtarД±Еџ vЙ™ SifariЕџ

Д°stifadЙ™Г§i sayt ГјzЙ™rindЙ™ mЙ™hsul axtara, mЙ™hsul detail sЙ™hifЙ™sinЙ™ keГ§Й™, mГ¶vcud planД± seГ§Й™ vЙ™ sifariЕџ dГјymЙ™si ilЙ™ WhatsApp sifariЕџ axД±nД±na davam edЙ™ bilЙ™r. BЙ™zi mЙ™hsullarda sifariЕџdЙ™n Й™vvЙ™l tЙ™sdiqlЙ™mЙ™ vЙ™ ya mЙ™lumat formasД± gГ¶stЙ™rilЙ™ bilЙ™r.

## Public Discovery ResurslarД±

- Sitemap: https://mirpanel.com/sitemap.xml
- Robots: https://mirpanel.com/robots.txt
- API Catalog: https://mirpanel.com/.well-known/api-catalog
- Agent Card: https://mirpanel.com/.well-known/agent-card.json

## Public API Status

Bu discovery sЙ™nЙ™di public sayt haqqД±nda mЙ™lumat verir. Admin panel, login, token, private API endpoint-lЙ™ri vЙ™ gizli idarЙ™etmЙ™ URL-lЙ™ri public discovery ГјГ§Гјn paylaЕџД±lmД±r.
`;

const SEO_ROUTES = {
  "/capcut-pro-almaq": ["CapCut Pro", "CapCut Pro almaq | Premium video montaj hesabД± - Mirpanel", "CapCut Pro hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Premium effektlЙ™r, 4K eksport vЙ™ WhatsApp ilЙ™ rahat sifariЕџ.", "/assets/capcut.png", "5.99"],
  "/netflix-almaq": ["Netflix ЕћЙ™xsi", "Netflix almaq | Ucuz Netflix Premium AzЙ™rbaycan - Mirpanel", "Netflix Premium hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. ЕћЙ™xsi profil, sГјrЙ™tli aktivlЙ™ЕџdirmЙ™ vЙ™ WhatsApp ilЙ™ rahat sifariЕџ.", "/assets/netflix.png", "5.99"],
  "/netflix-sexsi-almaq": ["Netflix ЕћЙ™xsi", "Netflix ЕћЙ™xsi almaq | Ucuz Netflix profil - Mirpanel", "Netflix ЕџЙ™xsi profil hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Netflix Premium ГјГ§Гјn rahat WhatsApp sifariЕџi.", "/assets/netflix.png", "5.99"],
  "/netflix-umumi-almaq": ["Netflix Гњmumi", "Netflix Гњmumi almaq | Ucuz Netflix hesab - Mirpanel", "Netflix Гјmumi profil hesabД±nД± sЙ™rfЙ™li qiymЙ™tЙ™ al. AzЙ™rbaycanda Netflix Premium paketlЙ™ri vЙ™ sГјrЙ™tli WhatsApp sifariЕџi.", "/assets/netflix.png", "3.99"],
  "/netflix-aile-almaq": ["Netflix AilЙ™", "Netflix AilЙ™ almaq | Netflix family hesab - Mirpanel", "Netflix ailЙ™ hesabД± vЙ™ Netflix Premium paketlЙ™rini AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et.", "/assets/netflix.png", "5.99"],
  "/spotify-premium-almaq": ["Spotify Premium", "Spotify Premium almaq | Ucuz Spotify hesab - Mirpanel", "Spotify Premium hesabД±nД± AzЙ™rbaycanda ucuz qiymЙ™tЙ™ Й™ldЙ™ et. ReklamsД±z musiqi, ЕџЙ™xsi hesab vЙ™ sГјrЙ™tli aktivlЙ™ЕџdirmЙ™.", "/assets/spotify.png", "4.99"],
  "/amazon-prime-video-almaq": ["Amazon Prime Video", "Amazon Prime Video almaq | Prime Video ucuz - Mirpanel", "Amazon Prime Video hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. Film vЙ™ seriallar ГјГ§Гјn Prime Video premium hesabД±.", "/assets/prime.png", "3.99"],
  "/hbo-max-almaq": ["HBO Max", "HBO Max almaq | Ucuz HBO Max hesab AzЙ™rbaycan - Mirpanel", "HBO Max hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. Premium film vЙ™ serial izlЙ™mЙ™ ГјГ§Гјn sГјrЙ™tli aktivlЙ™ЕџdirmЙ™.", "/uploads/products/hbomax-1783292107083-520c4b4a.jpg?v=1783292107083", "5.99"],
  "/youtube-premium-almaq": ["YouTube Premium", "YouTube Premium almaq | Ucuz YouTube hesab - Mirpanel", "YouTube Premium hesabД±nД± AzЙ™rbaycanda ucuz qiymЙ™tЙ™ Й™ldЙ™ et. ReklamsД±z YouTube vЙ™ YouTube Music ГјГ§Гјn premium paket.", "/assets/youtube.png", "3.49"],
  "/surfshark-vpn-almaq": ["Surfshark VPN", "Surfshark VPN almaq | Ucuz VPN AzЙ™rbaycan - Mirpanel", "Surfshark VPN hesabД±nД± sЙ™rfЙ™li qiymЙ™tЙ™ al. Premium VPN, tЙ™hlГјkЙ™siz baДџlantД± vЙ™ rahat aktivlЙ™ЕџdirmЙ™.", "/assets/surfshark.png", "3.99"],
  "/tiktok-jeton-almaq": ["TikTok Jeton", "TikTok Jeton almaq | Ucuz TikTok coin AzЙ™rbaycan - Mirpanel", "TikTok Jeton vЙ™ coin balansД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ artД±r. TikTok live hЙ™diyyЙ™lЙ™ri ГјГ§Гјn rahat sifariЕџ.", "/assets/tiktok.png", "10.00"],
  "/google-ai-pro-v3-almaq": ["Google AI Pro + VEO 3", "Google AI Pro V3 almaq | Gemini Pro hesab - Mirpanel", "Google AI Pro vЙ™ Gemini Pro hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. AI premium hesab ГјГ§Гјn rahat sifariЕџ.", "/assets/google-ai.png", "14.99"],
  "/google-ai-pro-ultra-almaq": ["Google AI Ultra + VEO 3", "Google AI Pro Ultra almaq | Gemini Ultra hesab - Mirpanel", "Google AI Ultra vЙ™ Gemini Ultra hesabД±nД± sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Premium AI imkanlarД± ГјГ§Гјn Mirpanel.", "/assets/google-ai-ultra.png", "39.99"],
  "/captions-ai-almaq": ["Captions AI", "Captions AI almaq | AI video montaj hesabД± - Mirpanel", "Captions AI Pro hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. AI video montaj vЙ™ premium hesab aktivlЙ™ЕџdirmЙ™.", "/assets/captions.png", "7.99"],
  "/grok-ai-almaq": ["Grok AI", "Grok AI almaq | Super Grok AI hesab - Mirpanel", "Grok AI vЙ™ Super Grok hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. AI premium hesab sifariЕџi.", "/assets/grok.png", "9.99"],
  "/super-grok-ai-almaq": ["Grok AI", "Super Grok AI almaq | Grok premium hesab - Mirpanel", "Super Grok AI hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. X AI Grok premium hesab sifariЕџi.", "/assets/grok.png", "9.99"],
  "/cloud-ai-pro-almaq": ["Claude AI", "Cloud AI Pro almaq | AI premium hesab - Mirpanel", "Cloud AI Pro vЙ™ AI premium hesablarД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Mirpanel ilЙ™ sГјrЙ™tli aktivlЙ™ЕџdirmЙ™.", "/assets/claude.png", "9.99"],
  "/cloud-ai-max-almaq": ["Claude AI", "Cloud AI Max almaq | AI premium hesab - Mirpanel", "Cloud AI Max vЙ™ AI premium hesablarД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Mirpanel ilЙ™ rahat sifariЕџ.", "/assets/claude.png", "9.99"],
  "/zoom-pro-almaq": ["Zoom Pro", "Zoom Pro almaq | Ucuz Zoom hesab AzЙ™rbaycan - Mirpanel", "Zoom Pro hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. Limitsiz gГ¶rГјЕџ vЙ™ premium meeting hesabД± ГјГ§Гјn Mirpanel.", "/assets/zoom.png", "9.99"],
  "/duolingo-super-almaq": ["Duolingo Super", "Duolingo Super almaq | Duolingo Premium ucuz - Mirpanel", "Duolingo Super hesabД±nД± AzЙ™rbaycanda ucuz qiymЙ™tЙ™ Й™ldЙ™ et. Dil Г¶yrЙ™nmЙ™ ГјГ§Гјn premium hesab.", "/assets/duolingo.png", "4.99"],
  "/canva-premium-almaq": ["Canva Premium", "Canva Premium almaq | Canva Pro ucuz qiymЙ™tЙ™ - Mirpanel", "Canva Premium vЙ™ Canva Pro hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. Dizayn ГјГ§Гјn premium hesab.", "/assets/canva.png", "4.99"],
  "/chatgpt-plus-almaq": ["ChatGPT Plus", "ChatGPT Plus almaq | Ucuz ChatGPT hesab AzЙ™rbaycan - Mirpanel", "ChatGPT Plus hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et. GPT vЙ™ OpenAI premium hesab sifariЕџi.", "/assets/chatgpt.png", "19.99"],
  "/adobe-creative-cloud-almaq": ["Adobe Creative Cloud", "Adobe Creative Cloud almaq | Adobe CC ucuz - Mirpanel", "Adobe Creative Cloud hesabД±nД± AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ al. Photoshop, Illustrator, Premiere Pro vЙ™ digЙ™r Adobe proqramlarД±.", "/assets/adobe.png", "9.99"]
};

const SEO_ALIASES = {
  netflix: ["netflix-almaq", "netflix-aile-almaq"],
  prime: ["prime-video-almaq"],
  google_ai: ["gemini-pro-almaq"],
  google_ai_ultra: ["gemini-ultra-almaq"],
  grok_supergrok: ["grok-ai-almaq"],
  claude_ai: ["cloud-ai-max-almaq", "claude-ai-almaq"],
  canva: ["canva-pro-almaq"],
  adobecc: ["adobe-cc-almaq"]
};

function wantsMarkdown(request){return(request.headers.get("Accept")||"").toLowerCase().includes("text/markdown")}
function isStaticAsset(pathname){return STATIC_ASSET_RE.test(pathname)}
function isHtmlLikePath(pathname){if(pathname==="/"||pathname==="")return true;if(pathname.endsWith("/"))return true;if(pathname.endsWith(".html"))return true;return Boolean(SEO_ROUTES[pathname.replace(/\/+$/,"")||"/"])}
function estimateTokens(markdown){const words=markdown.trim().split(/\s+/).filter(Boolean).length;return String(Math.max(1,Math.ceil(words*1.35)))}
function absoluteUrl(path){return new URL(path||"/",BASE_URL).href}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function slug(value){return String(value||"").trim().toLowerCase().replace(/[Й™ЖЏ]/g,"e").replace(/[Д±Д°]/g,"i").replace(/[Г¶Г–]/g,"o").replace(/[ГјГњ]/g,"u").replace(/[ЕџЕћ]/g,"s").replace(/[Г§Г‡]/g,"c").replace(/[ДџДћ]/g,"g").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function extractObject(source, marker){const startMarker=source.indexOf(marker);if(startMarker<0)return null;const start=source.indexOf("{",startMarker);if(start<0)return null;let depth=0,quote="",escaped=false;for(let i=start;i<source.length;i++){const ch=source[i];if(quote){if(escaped)escaped=false;else if(ch==="\\")escaped=true;else if(ch===quote)quote="";continue}if(ch==="\""||ch==="'"||ch==="`"){quote=ch;continue}if(ch==="{")depth++;if(ch==="}"){depth--;if(depth===0)return source.slice(start,i+1)}}return null}
function minPrice(product){const prices=(product?.plans||[]).map((plan)=>Number(plan.price)).filter((price)=>price>0);return prices.length?Math.min(...prices).toFixed(2):"0.00"}
async function productSeoRoutes(request){try{const response=await fetch(new URL("/app.js",request.url));if(!response.ok)return{};const source=await response.text();const block=extractObject(source,"const DATA");if(!block)return{};const data=JSON.parse(block);const routes={};for(const product of data.products||[]){if(product.active===false)continue;const baseSlug=slug(product.seoSlug||`${product.title||product.id}-almaq`);const aliases=(SEO_ALIASES[product.id]||[]).map(slug);for(const item of [baseSlug,...aliases].filter(Boolean)){const route=`/${item}`;const fallback=SEO_ROUTES[route]||[];routes[route]=[product.title||fallback[0]||"Premium hesab",product.seoTitle||fallback[1]||`${product.title||"Premium hesab"} almaq | Mirpanel`,product.seoDescription||fallback[2]||`${product.title||"Premium hesab"} mЙ™hsulunu AzЙ™rbaycanda sЙ™rfЙ™li qiymЙ™tЙ™ Й™ldЙ™ et.`,product.image||fallback[3]||DEFAULT_IMAGE,minPrice(product)]}}return routes}catch{return{}}}
function withSeoScripts(html){let next=html;if(!next.includes("seo.js?v=20260710-seo-1")){next=next.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i,'<script src="seo.js?v=20260710-seo-1"></script>\n  $&')}if(!next.includes("seo-router.js?v=20260710-seo-1")){next=next.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i,'$&\n  <script src="seo-router.js?v=20260710-seo-1"></script>')}if(!next.includes("site-sections-render.js?v=20260711-sections-1")){next=next.replace(/<script src="app\.js[^>]*><\/script>/i,'$&\n  <script src="site-sections-render.js?v=20260711-sections-1"></script>')}return next}
function injectMeta(html,route,data){const[name,title,description,imagePath,price]=data;const canonical=`${BASE_URL}${route}`;const image=absoluteUrl(imagePath||DEFAULT_IMAGE);const schema={"@context":"https://schema.org","@type":"Product",name,description,image,brand:{"@type":"Brand",name:"Mirpanel"},offers:{"@type":"Offer",price,priceCurrency:"AZN",availability:"https://schema.org/InStock",url:canonical}};let next=withSeoScripts(html).replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`).replace(/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${escapeHtml(description)}" />`).replace(/<meta\s+property=["']og:title["'][^>]*>/i,`<meta property="og:title" content="${escapeHtml(title)}" />`).replace(/<meta\s+property=["']og:description["'][^>]*>/i,`<meta property="og:description" content="${escapeHtml(description)}" />`).replace(/<meta\s+property=["']og:image["'][^>]*>/i,`<meta property="og:image" content="${image}" />`).replace(/<meta\s+property=["']og:type["'][^>]*>/i,'<meta property="og:type" content="product" />');if(next.match(/<link\s+rel=["']canonical["'][^>]*>/i)){next=next.replace(/<link\s+rel=["']canonical["'][^>]*>/i,`<link rel="canonical" href="${canonical}" />`)}else{next=next.replace(/<\/head>/i,`<link rel="canonical" href="${canonical}" />\n</head>`)}const extras=`\n<meta property="og:url" content="${canonical}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${escapeHtml(title)}" />\n<meta name="twitter:description" content="${escapeHtml(description)}" />\n<meta name="twitter:image" content="${image}" />\n<script type="application/ld+json" id="mirpanel-edge-product-schema">${JSON.stringify(schema)}</script>`;return next.replace(/<\/head>/i,`${extras}\n</head>`)}

export async function onRequest(context){const{request}=context;const url=new URL(request.url);const pathname=url.pathname;const route=pathname.replace(/\/+$/,"")||"/";if(isStaticAsset(pathname))return context.next();if(wantsMarkdown(request)&&isHtmlLikePath(pathname)){return new Response(MARKDOWN,{status:200,headers:{"Content-Type":"text/markdown; charset=utf-8","Vary":"Accept","x-markdown-tokens":estimateTokens(MARKDOWN),"Link":"</.well-known/api-catalog>; rel=\"api-catalog\"; type=\"application/json\", </sitemap.xml>; rel=\"sitemap\"; type=\"application/xml\""}})}const response=await context.next();const contentType=response.headers.get("Content-Type")||"";if(!contentType.includes("text/html"))return response;let html=await response.text();const dynamicRoutes=await productSeoRoutes(request);const routeData=dynamicRoutes[route]||SEO_ROUTES[route];html=routeData?injectMeta(html,route,routeData):withSeoScripts(html);const headers=new Headers(response.headers);headers.set("Content-Type","text/html; charset=utf-8");headers.append("Vary","Accept");return new Response(html,{status:response.status,headers})}
