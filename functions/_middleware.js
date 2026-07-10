const STATIC_ASSET_RE = /\.(?:js|css|png|jpe?g|webp|svg|ico|gif|avif|xml|txt|json|map|woff2?|ttf|eot|pdf)$/i;

const BASE_URL = "https://mirpanel.com";
const DEFAULT_IMAGE = `${BASE_URL}/assets/logo.png`;

const MARKDOWN = `---
title: Mirpanel
description: Premium hesablar və etibarlı aktivləşdirmə xidməti.
url: https://mirpanel.com/
---

# Mirpanel

Mirpanel premium hesablar və rəqəmsal xidmətlər üçün public saytıdır. Saytda məhsullar, qiymətlər, stok statusu və sifariş düymələri göstərilir. Brauzer istifadəçiləri üçün normal HTML sayt əsas cavab olaraq qalır.

## Əsas Menyu

- Ana Səhifə
- Məhsullar
- Haqqımızda
- Şərtlər
- Əlaqə

## Məhsullar Haqqında

Mirpanel-də Netflix, Spotify, YouTube Premium, CapCut Pro, Zoom Pro, HBO Max, Amazon Prime Video və digər premium hesab və xidmətlər təqdim olunur. Məhsul kartlarında ad, kateqoriya, qiymət və varsa stok statusu göstərilir.

## Axtarış və Sifariş

İstifadəçi sayt üzərində məhsul axtara, məhsul detail səhifəsinə keçə, mövcud planı seçə və sifariş düyməsi ilə WhatsApp sifariş axınına davam edə bilər. Bəzi məhsullarda sifarişdən əvvəl təsdiqləmə və ya məlumat forması göstərilə bilər.

## Public Discovery Resursları

- Sitemap: https://mirpanel.com/sitemap.xml
- Robots: https://mirpanel.com/robots.txt
- API Catalog: https://mirpanel.com/.well-known/api-catalog
- Agent Card: https://mirpanel.com/.well-known/agent-card.json

## Public API Status

Bu discovery sənədi public sayt haqqında məlumat verir. Admin panel, login, token, private API endpoint-ləri və gizli idarəetmə URL-ləri public discovery üçün paylaşılmır.
`;

const SEO_ROUTES = {
  "/capcut-pro-almaq": ["CapCut Pro", "CapCut Pro almaq | Premium video montaj hesabı - Mirpanel", "CapCut Pro hesabını Azərbaycanda sərfəli qiymətə əldə et. Premium effektlər, 4K eksport və WhatsApp ilə rahat sifariş.", "/assets/capcut.png", "5.99"],
  "/netflix-almaq": ["Netflix Şəxsi", "Netflix almaq | Ucuz Netflix Premium Azərbaycan - Mirpanel", "Netflix Premium hesabını Azərbaycanda sərfəli qiymətə əldə et. Şəxsi profil, sürətli aktivləşdirmə və WhatsApp ilə rahat sifariş.", "/assets/netflix.png", "5.99"],
  "/netflix-sexsi-almaq": ["Netflix Şəxsi", "Netflix Şəxsi almaq | Ucuz Netflix profil - Mirpanel", "Netflix şəxsi profil hesabını Azərbaycanda sərfəli qiymətə əldə et. Netflix Premium üçün rahat WhatsApp sifarişi.", "/assets/netflix.png", "5.99"],
  "/netflix-umumi-almaq": ["Netflix Ümumi", "Netflix Ümumi almaq | Ucuz Netflix hesab - Mirpanel", "Netflix ümumi profil hesabını sərfəli qiymətə al. Azərbaycanda Netflix Premium paketləri və sürətli WhatsApp sifarişi.", "/assets/netflix.png", "3.99"],
  "/netflix-aile-almaq": ["Netflix Ailə", "Netflix Ailə almaq | Netflix family hesab - Mirpanel", "Netflix ailə hesabı və Netflix Premium paketlərini Azərbaycanda sərfəli qiymətə əldə et.", "/assets/netflix.png", "5.99"],
  "/spotify-premium-almaq": ["Spotify Premium", "Spotify Premium almaq | Ucuz Spotify hesab - Mirpanel", "Spotify Premium hesabını Azərbaycanda ucuz qiymətə əldə et. Reklamsız musiqi, şəxsi hesab və sürətli aktivləşdirmə.", "/assets/spotify.png", "4.99"],
  "/amazon-prime-video-almaq": ["Amazon Prime Video", "Amazon Prime Video almaq | Prime Video ucuz - Mirpanel", "Amazon Prime Video hesabını Azərbaycanda sərfəli qiymətə al. Film və seriallar üçün Prime Video premium hesabı.", "/assets/prime.png", "3.99"],
  "/hbo-max-almaq": ["HBO Max", "HBO Max almaq | Ucuz HBO Max hesab Azərbaycan - Mirpanel", "HBO Max hesabını Azərbaycanda sərfəli qiymətə al. Premium film və serial izləmə üçün sürətli aktivləşdirmə.", "/uploads/products/hbomax-1783292107083-520c4b4a.jpg?v=1783292107083", "5.99"],
  "/youtube-premium-almaq": ["YouTube Premium", "YouTube Premium almaq | Ucuz YouTube hesab - Mirpanel", "YouTube Premium hesabını Azərbaycanda ucuz qiymətə əldə et. Reklamsız YouTube və YouTube Music üçün premium paket.", "/assets/youtube.png", "3.49"],
  "/surfshark-vpn-almaq": ["Surfshark VPN", "Surfshark VPN almaq | Ucuz VPN Azərbaycan - Mirpanel", "Surfshark VPN hesabını sərfəli qiymətə al. Premium VPN, təhlükəsiz bağlantı və rahat aktivləşdirmə.", "/assets/surfshark.png", "3.99"],
  "/tiktok-jeton-almaq": ["TikTok Jeton", "TikTok Jeton almaq | Ucuz TikTok coin Azərbaycan - Mirpanel", "TikTok Jeton və coin balansını Azərbaycanda sərfəli qiymətə artır. TikTok live hədiyyələri üçün rahat sifariş.", "/assets/tiktok.png", "10.00"],
  "/google-ai-pro-v3-almaq": ["Google AI Pro + VEO 3", "Google AI Pro V3 almaq | Gemini Pro hesab - Mirpanel", "Google AI Pro və Gemini Pro hesabını Azərbaycanda sərfəli qiymətə al. AI premium hesab üçün rahat sifariş.", "/assets/google-ai.png", "14.99"],
  "/google-ai-pro-ultra-almaq": ["Google AI Ultra + VEO 3", "Google AI Pro Ultra almaq | Gemini Ultra hesab - Mirpanel", "Google AI Ultra və Gemini Ultra hesabını sərfəli qiymətə əldə et. Premium AI imkanları üçün Mirpanel.", "/assets/google-ai-ultra.png", "39.99"],
  "/captions-ai-almaq": ["Captions AI", "Captions AI almaq | AI video montaj hesabı - Mirpanel", "Captions AI Pro hesabını Azərbaycanda sərfəli qiymətə al. AI video montaj və premium hesab aktivləşdirmə.", "/assets/captions.png", "7.99"],
  "/grok-ai-almaq": ["Grok AI", "Grok AI almaq | Super Grok AI hesab - Mirpanel", "Grok AI və Super Grok hesabını Azərbaycanda sərfəli qiymətə əldə et. AI premium hesab sifarişi.", "/assets/grok.png", "9.99"],
  "/super-grok-ai-almaq": ["Grok AI", "Super Grok AI almaq | Grok premium hesab - Mirpanel", "Super Grok AI hesabını Azərbaycanda sərfəli qiymətə əldə et. X AI Grok premium hesab sifarişi.", "/assets/grok.png", "9.99"],
  "/cloud-ai-pro-almaq": ["Claude AI", "Cloud AI Pro almaq | AI premium hesab - Mirpanel", "Cloud AI Pro və AI premium hesablarını Azərbaycanda sərfəli qiymətə əldə et. Mirpanel ilə sürətli aktivləşdirmə.", "/assets/claude.png", "9.99"],
  "/cloud-ai-max-almaq": ["Claude AI", "Cloud AI Max almaq | AI premium hesab - Mirpanel", "Cloud AI Max və AI premium hesablarını Azərbaycanda sərfəli qiymətə əldə et. Mirpanel ilə rahat sifariş.", "/assets/claude.png", "9.99"],
  "/zoom-pro-almaq": ["Zoom Pro", "Zoom Pro almaq | Ucuz Zoom hesab Azərbaycan - Mirpanel", "Zoom Pro hesabını Azərbaycanda sərfəli qiymətə al. Limitsiz görüş və premium meeting hesabı üçün Mirpanel.", "/assets/zoom.png", "9.99"],
  "/duolingo-super-almaq": ["Duolingo Super", "Duolingo Super almaq | Duolingo Premium ucuz - Mirpanel", "Duolingo Super hesabını Azərbaycanda ucuz qiymətə əldə et. Dil öyrənmə üçün premium hesab.", "/assets/duolingo.png", "4.99"],
  "/canva-premium-almaq": ["Canva Premium", "Canva Premium almaq | Canva Pro ucuz qiymətə - Mirpanel", "Canva Premium və Canva Pro hesabını Azərbaycanda sərfəli qiymətə əldə et. Dizayn üçün premium hesab.", "/assets/canva.png", "4.99"],
  "/chatgpt-plus-almaq": ["ChatGPT Plus", "ChatGPT Plus almaq | Ucuz ChatGPT hesab Azərbaycan - Mirpanel", "ChatGPT Plus hesabını Azərbaycanda sərfəli qiymətə əldə et. GPT və OpenAI premium hesab sifarişi.", "/assets/chatgpt.png", "19.99"],
  "/adobe-creative-cloud-almaq": ["Adobe Creative Cloud", "Adobe Creative Cloud almaq | Adobe CC ucuz - Mirpanel", "Adobe Creative Cloud hesabını Azərbaycanda sərfəli qiymətə al. Photoshop, Illustrator, Premiere Pro və digər Adobe proqramları.", "/assets/adobe.png", "9.99"]
};

function wantsMarkdown(request){return(request.headers.get("Accept")||"").toLowerCase().includes("text/markdown")}
function isStaticAsset(pathname){return STATIC_ASSET_RE.test(pathname)}
function isHtmlLikePath(pathname){if(pathname==="/"||pathname==="")return true;if(pathname.endsWith("/"))return true;if(pathname.endsWith(".html"))return true;return Boolean(SEO_ROUTES[pathname.replace(/\/+$/,"")||"/"])}
function estimateTokens(markdown){const words=markdown.trim().split(/\s+/).filter(Boolean).length;return String(Math.max(1,Math.ceil(words*1.35)))}
function absoluteUrl(path){return new URL(path||"/",BASE_URL).href}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function withSeoScripts(html){let next=html;if(!next.includes("seo.js?v=20260710-seo-1")){next=next.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i,'<script src="seo.js?v=20260710-seo-1"></script>\n  $&')}if(!next.includes("seo-router.js?v=20260710-seo-1")){next=next.replace(/<script src="frontend-routing-detail-fix\.js[^>]*><\/script>/i,'$&\n  <script src="seo-router.js?v=20260710-seo-1"></script>')}return next}
function injectMeta(html,route,data){const[name,title,description,imagePath,price]=data;const canonical=`${BASE_URL}${route}`;const image=absoluteUrl(imagePath||DEFAULT_IMAGE);const schema={"@context":"https://schema.org","@type":"Product",name,description,image,brand:{"@type":"Brand",name:"Mirpanel"},offers:{"@type":"Offer",price,priceCurrency:"AZN",availability:"https://schema.org/InStock",url:canonical}};let next=withSeoScripts(html).replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`).replace(/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${escapeHtml(description)}" />`).replace(/<meta\s+property=["']og:title["'][^>]*>/i,`<meta property="og:title" content="${escapeHtml(title)}" />`).replace(/<meta\s+property=["']og:description["'][^>]*>/i,`<meta property="og:description" content="${escapeHtml(description)}" />`).replace(/<meta\s+property=["']og:image["'][^>]*>/i,`<meta property="og:image" content="${image}" />`).replace(/<meta\s+property=["']og:type["'][^>]*>/i,'<meta property="og:type" content="product" />');if(next.match(/<link\s+rel=["']canonical["'][^>]*>/i)){next=next.replace(/<link\s+rel=["']canonical["'][^>]*>/i,`<link rel="canonical" href="${canonical}" />`)}else{next=next.replace(/<\/head>/i,`<link rel="canonical" href="${canonical}" />\n</head>`)}const extras=`\n<meta property="og:url" content="${canonical}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${escapeHtml(title)}" />\n<meta name="twitter:description" content="${escapeHtml(description)}" />\n<meta name="twitter:image" content="${image}" />\n<script type="application/ld+json" id="mirpanel-edge-product-schema">${JSON.stringify(schema)}</script>`;return next.replace(/<\/head>/i,`${extras}\n</head>`)}

export async function onRequest(context){const{request}=context;const url=new URL(request.url);const pathname=url.pathname;const route=pathname.replace(/\/+$/,"")||"/";if(isStaticAsset(pathname))return context.next();if(wantsMarkdown(request)&&isHtmlLikePath(pathname)){return new Response(MARKDOWN,{status:200,headers:{"Content-Type":"text/markdown; charset=utf-8","Vary":"Accept","x-markdown-tokens":estimateTokens(MARKDOWN),"Link":"</.well-known/api-catalog>; rel=\"api-catalog\"; type=\"application/json\", </sitemap.xml>; rel=\"sitemap\"; type=\"application/xml\""}})}const response=await context.next();const contentType=response.headers.get("Content-Type")||"";if(!contentType.includes("text/html"))return response;let html=await response.text();html=SEO_ROUTES[route]?injectMeta(html,route,SEO_ROUTES[route]):withSeoScripts(html);const headers=new Headers(response.headers);headers.set("Content-Type","text/html; charset=utf-8");headers.append("Vary","Accept");return new Response(html,{status:response.status,headers})}
