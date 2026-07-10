import fs from 'node:fs';

const TODAY = '2026-07-10';

const seo = {
  capcut: ['capcut-pro-almaq','CapCut Pro almaq | Ucuz CapCut Pro Azərbaycan - Mirpanel','CapCut Pro hesabını Azərbaycanda sərfəli qiymətə əldə et. Video montaj üçün premium funksiyalar və sürətli aktivləşdirmə.','CapCut Pro almaq, CapCut Pro ucuz, CapCut Pro Azərbaycan, CapCut hesab almaq, CapCut premium, CapCut Pro video montaj, CapCut Pro aktivləşdirmə, CapCut Pro qiyməti, CapCut Pro hazır hesab','CapCut Pro video montaj edən istifadəçilər üçün premium effektlər, şablonlar və əlavə funksiyalar təqdim edir. Mirpanel vasitəsilə CapCut Pro hesabını Azərbaycanda sərfəli qiymətə əldə edə bilərsiniz. Sifariş prosesi sadədir və aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  netflix: ['netflix-sexsi-almaq','Netflix Şəxsi almaq | Ucuz Netflix Premium Azərbaycan - Mirpanel','Netflix şəxsi hesabını sərfəli qiymətə əldə et. Premium izləmə, rahat sifariş və sürətli aktivləşdirmə Mirpanel-də.','Netflix şəxsi almaq, Netflix şəxsi hesab, Netflix almaq, Netflix Premium almaq, Netflix ucuz, Netflix Azərbaycan, Netflix hesab almaq, Netflix profil almaq, Netflix aylıq','Netflix Şəxsi hesab öz profilindən istifadə etmək istəyənlər üçün rahat seçimdir. Mirpanel Netflix Premium hesablarını Azərbaycanda sərfəli qiymətə təqdim edir. Sifariş WhatsApp üzərindən tamamlanır və aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  netflix_umumi: ['netflix-umumi-almaq','Netflix Ümumi almaq | Ucuz Netflix hesab Azərbaycan - Mirpanel','Netflix ümumi hesabını sərfəli qiymətə al. Film və serialları rahat izləmək üçün sürətli aktivləşdirmə.','Netflix ümumi almaq, Netflix ümumi hesab, Netflix almaq, Netflix ucuz almaq, Netflix Azərbaycan, Netflix Premium qiyməti, Netflix hesab qiyməti, Netflix paket almaq','Netflix Ümumi hesab film və serial izləmək istəyənlər üçün sərfəli premium seçimdir. Mirpanel vasitəsilə Netflix hesabını rahat sifariş edə və qısa müddətdə aktivləşdirə bilərsiniz. Azərbaycanda ucuz Netflix almaq istəyənlər üçün uyğun seçimdir.'],
  spotify: ['spotify-premium-almaq','Spotify Premium almaq | Ucuz Spotify hesab Azərbaycan - Mirpanel','Spotify Premium hesabını sərfəli qiymətə al. Reklamsız musiqi, premium imkanlar və sürətli aktivləşdirmə.','Spotify almaq, Spotify Premium almaq, Spotify ucuz, Spotify Azərbaycan, Spotify hesab almaq, Spotify aylıq, Spotify reklamsız, Spotify premium hesab, Spotify qiyməti','Spotify Premium ilə reklamsız musiqi dinləyə, playlistlərinizi rahat idarə edə və premium imkanlardan istifadə edə bilərsiniz. Mirpanel Spotify Premium almaq istəyənlər üçün sərfəli qiymət və sürətli aktivləşdirmə təqdim edir. Sifariş prosesi sadədir və WhatsApp üzərindən tamamlanır.'],
  prime: ['amazon-prime-video-almaq','Amazon Prime Video almaq | Ucuz Prime Video Azərbaycan - Mirpanel','Amazon Prime Video hesabını sərfəli qiymətə əldə et. Film və serial izləmək üçün premium hesab Mirpanel-də.','Amazon Prime Video almaq, Prime Video almaq, Amazon Prime almaq, Amazon Prime ucuz, Prime Video ucuz, Amazon Prime Azərbaycan, Prime Video Azərbaycan, Amazon Prime hesab almaq','Amazon Prime Video film və serial izləmək üçün premium platformalardan biridir. Mirpanel vasitəsilə Prime Video hesabını Azərbaycanda sərfəli qiymətə əldə edə bilərsiniz. Sifariş rahatdır və aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  hbomax: ['hbo-max-almaq','HBO Max almaq | Ucuz HBO Max hesab Azərbaycan - Mirpanel','HBO Max hesabını sərfəli qiymətə al. Film, serial və premium izləmə imkanları Mirpanel-də.','HBO Max almaq, HBO Max ucuz, HBO Max qiyməti, HBO Max Azərbaycan, HBO Max hesab almaq, HBO Max aylıq, HBO Max premium, HBO Max film hesabı','HBO Max premium film və serial izləmək istəyənlər üçün geniş məzmun təqdim edir. Mirpanel HBO Max hesablarını Azərbaycanda sərfəli qiymətə təklif edir. Sifariş WhatsApp üzərindən rahat şəkildə tamamlanır.'],
  youtube: ['youtube-premium-almaq','YouTube Premium almaq | Ucuz YouTube hesab Azərbaycan - Mirpanel','YouTube Premium hesabını sərfəli qiymətə əldə et. Reklamsız video, YouTube Music və premium imkanlar.','YouTube Premium almaq, YouTube Premium ucuz, YouTube Premium Azərbaycan, YouTube hesab almaq, YouTube reklamsız almaq, YouTube Music almaq, Youtube premium almaq, Yutub premium almaq','YouTube Premium ilə reklamsız video izləyə və YouTube Music imkanlarından istifadə edə bilərsiniz. Mirpanel YouTube Premium hesablarını Azərbaycanda sərfəli qiymətə təqdim edir. Sifariş prosesi sadədir və aktivləşdirmə qısa müddətdə edilir.'],
  surfshark: ['surfshark-vpn-almaq','Surfshark VPN almaq | Ucuz VPN Azərbaycan - Mirpanel','Surfshark VPN hesabını sərfəli qiymətə al. Təhlükəsiz internet və premium VPN xidməti Mirpanel-də.','Surfshark VPN almaq, Surfshark almaq, Surfshark VPN ucuz, VPN almaq, ucuz VPN almaq, VPN Azərbaycan, premium VPN almaq, Surfshark hesab almaq','Surfshark VPN internetdə daha təhlükəsiz və rahat istifadə üçün premium VPN xidmətidir. Mirpanel Surfshark VPN hesabını Azərbaycanda sərfəli qiymətə təqdim edir. VPN almaq istəyənlər üçün etibarlı və rahat seçimdir.'],
  tiktok_jeton: ['tiktok-jeton-almaq','TikTok Jeton almaq | Ucuz TikTok coin Azərbaycan - Mirpanel','TikTok jeton və coin almaq üçün sərfəli seçim. Balans artırma və rahat sifariş Mirpanel-də.','TikTok Jeton almaq, TikTok jeton ucuz, TikTok jeton Azərbaycan, TikTok coin almaq, TikTok coin ucuz, TikTok balans artırmaq, TikTok hədiyyə jeton','TikTok Jeton canlı yayımlarda hədiyyə göndərmək və balans artırmaq üçün istifadə olunur. Mirpanel TikTok jeton almaq istəyənlər üçün rahat və sərfəli sifariş imkanı təqdim edir. Sifariş prosesi sadədir və WhatsApp üzərindən aparılır.'],
  google_ai: ['google-ai-pro-v3-almaq','Google AI Pro V3 almaq | Ucuz Google AI hesab - Mirpanel','Google AI Pro V3 hesabını sərfəli qiymətə əldə et. AI premium imkanları və sürətli aktivləşdirmə.','Google AI Pro almaq, Google AI Pro V3 almaq, Google AI ucuz, Google AI Azərbaycan, Google AI hesab almaq, Google Gemini Pro almaq, Gemini AI almaq','Google AI Pro V3 süni intellekt imkanlarından daha geniş istifadə etmək istəyənlər üçün premium seçimdir. Mirpanel Google AI hesablarını sərfəli qiymətə təqdim edir. AI premium hesab almaq istəyənlər üçün rahat sifariş imkanı var.'],
  google_ai_ultra: ['google-ai-pro-ultra-almaq','Google AI Pro Ultra almaq | Gemini Ultra hesab - Mirpanel','Google AI Pro Ultra hesabını sərfəli qiymətə al. Premium AI imkanları və sürətli aktivləşdirmə.','Google AI Pro Ultra almaq, Google AI Ultra almaq, Google AI Ultra ucuz, Google Gemini Ultra almaq, Gemini Ultra almaq, Gemini Advanced almaq, Google AI premium hesab','Google AI Pro Ultra daha güclü süni intellekt imkanları üçün premium hesab seçimidir. Mirpanel vasitəsilə Google AI Pro Ultra hesabını Azərbaycanda sərfəli qiymətə əldə edə bilərsiniz. Aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  captions: ['captions-ai-almaq','Captions AI almaq | Ucuz Captions AI Pro - Mirpanel','Captions AI hesabını sərfəli qiymətə əldə et. AI video montaj və premium alətlər Mirpanel-də.','Captions AI almaq, Captions AI Pro almaq, Captions AI ucuz, Captions AI Azərbaycan, Captions AI hesab almaq, Captions premium almaq, AI video montaj almaq','Captions AI video kontent hazırlayanlar üçün süni intellekt əsaslı premium alətlər təqdim edir. Mirpanel Captions AI hesabını sərfəli qiymətə əldə etmək istəyənlər üçün rahat sifariş imkanı yaradır. AI video montaj üçün yaxşı seçimdir.'],
  grok_supergrok: ['grok-ai-almaq','Grok AI almaq | Ucuz Grok AI hesab Azərbaycan - Mirpanel','Grok AI hesabını sərfəli qiymətə əldə et. Premium AI imkanları və rahat sifariş Mirpanel-də.','Grok AI almaq, Grok AI Pro almaq, Grok AI ucuz, Grok AI Azərbaycan, Grok hesab almaq, Grok premium almaq, X AI Grok almaq, Super Grok almaq, Super Grok AI almaq','Grok AI süni intellekt imkanlarından istifadə etmək istəyənlər üçün premium hesab seçimidir. Mirpanel Grok AI hesablarını Azərbaycanda sərfəli qiymətə təqdim edir. Sifariş rahat şəkildə WhatsApp üzərindən tamamlanır.'],
  claude_ai: ['cloud-ai-pro-almaq','Cloud AI Pro almaq | Ucuz Cloud AI hesab - Mirpanel','Cloud AI Pro hesabını sərfəli qiymətə əldə et. Premium AI imkanları və sürətli aktivləşdirmə.','Cloud AI Pro almaq, Cloud AI ucuz, Cloud AI qiyməti, Cloud AI Azərbaycan, Cloud AI hesab almaq, Cloud AI premium, AI hesab almaq, AI premium hesab, Cloud AI Max almaq','Cloud AI Pro süni intellekt imkanlarından daha rahat istifadə etmək istəyənlər üçün premium hesab seçimidir. Mirpanel Cloud AI Pro hesabını sərfəli qiymətə təqdim edir. AI premium hesab almaq istəyənlər üçün uyğun seçimdir.'],
  zoom: ['zoom-pro-almaq','Zoom Pro almaq | Ucuz Zoom hesab Azərbaycan - Mirpanel','Zoom Pro hesabını sərfəli qiymətə əldə et. Online görüşlər və premium Zoom imkanları Mirpanel-də.','Zoom Pro almaq, Zoom Pro ucuz, Zoom Pro Azərbaycan, Zoom hesab almaq, Zoom premium almaq, Zoom meeting hesabı, Zoom görüş hesabı, Zoom limitsiz görüş','Zoom Pro online görüşlər, dərslər və iş toplantıları üçün premium imkanlar təqdim edir. Mirpanel Zoom Pro hesabını Azərbaycanda sərfəli qiymətə əldə etmək istəyənlər üçün rahat sifariş imkanı yaradır. Aktivləşdirmə sürətli şəkildə həyata keçirilir.'],
  duolingo: ['duolingo-super-almaq','Duolingo Super almaq | Ucuz Duolingo hesab - Mirpanel','Duolingo Super hesabını sərfəli qiymətə əldə et. Dil öyrənmək üçün premium imkanlar Mirpanel-də.','Duolingo Super almaq, Duolingo Premium almaq, Duolingo ucuz, Duolingo Azərbaycan, Duolingo hesab almaq, Duolingo Super hesab, Duolingo dil öyrənmə','Duolingo Super dil öyrənmək istəyənlər üçün daha rahat və premium imkanlar təqdim edir. Mirpanel Duolingo Super hesabını sərfəli qiymətə təqdim edir. Dil öyrənmə prosesini daha effektiv etmək istəyənlər üçün uyğun seçimdir.'],
  canva: ['canva-premium-almaq','Canva Premium almaq | Ucuz Canva Pro Azərbaycan - Mirpanel','Canva Premium və Canva Pro hesabını sərfəli qiymətə əldə et. Dizayn üçün premium alətlər Mirpanel-də.','Canva Premium almaq, Canva Pro almaq, Canva ucuz, Canva Azərbaycan, Canva hesab almaq, Canva Pro hesab, Canva dizayn hesabı, Kanva almaq','Canva Premium dizayn hazırlamaq, sosial media postları və təqdimatlar yaratmaq üçün premium imkanlar təqdim edir. Mirpanel Canva Pro hesabını Azərbaycanda sərfəli qiymətə əldə etmək istəyənlər üçün rahat seçimdir. Aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  chatgpt: ['chatgpt-plus-almaq','ChatGPT Plus almaq | Ucuz ChatGPT hesab Azərbaycan - Mirpanel','ChatGPT Plus hesabını sərfəli qiymətə əldə et. Premium AI imkanları və sürətli aktivləşdirmə Mirpanel-də.','ChatGPT Plus almaq, ChatGPT Plus ucuz, ChatGPT Plus Azərbaycan, ChatGPT hesab almaq, ChatGPT premium almaq, GPT Plus almaq, OpenAI hesab almaq, ÇatGPT almaq','ChatGPT Plus süni intellekt imkanlarından daha geniş istifadə etmək istəyənlər üçün premium hesab seçimidir. Mirpanel ChatGPT Plus hesabını Azərbaycanda sərfəli qiymətə təqdim edir. Sifariş prosesi rahatdır və aktivləşdirmə qısa müddətdə həyata keçirilir.'],
  adobecc: ['adobe-creative-cloud-almaq','Adobe Creative Cloud almaq | Ucuz Adobe hesab - Mirpanel','Adobe Creative Cloud hesabını sərfəli qiymətə əldə et. Photoshop, Illustrator və premium Adobe alətləri.','Adobe Creative Cloud almaq, Adobe CC almaq, Adobe ucuz, Adobe Azərbaycan, Adobe hesab almaq, Photoshop almaq, Illustrator almaq, Premiere Pro almaq, Adobe paket almaq','Adobe Creative Cloud dizayn, video montaj və kreativ işlər üçün premium proqramlar təqdim edir. Mirpanel Adobe hesabını sərfəli qiymətə əldə etmək istəyənlər üçün rahat sifariş imkanı yaradır. Photoshop, Illustrator və digər Adobe alətlərindən istifadə üçün uyğun seçimdir.']
};

const aliases = {
  netflix: ['netflix-almaq','netflix-aile-almaq'],
  prime: ['prime-video-almaq'],
  google_ai: ['gemini-pro-almaq'],
  google_ai_ultra: ['gemini-ultra-almaq'],
  grok_supergrok: ['super-grok-ai-almaq'],
  claude_ai: ['cloud-ai-max-almaq','claude-ai-almaq'],
  canva: ['canva-pro-almaq'],
  adobecc: ['adobe-cc-almaq']
};

function slug(value) {
  return String(value || '')
    .trim().toLowerCase()
    .replace(/[əƏ]/g,'e').replace(/[ıİ]/g,'i').replace(/[öÖ]/g,'o')
    .replace(/[üÜ]/g,'u').replace(/[şŞ]/g,'s').replace(/[çÇ]/g,'c').replace(/[ğĞ]/g,'g')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function generic(product) {
  const name = product.title || product.id || 'Premium hesab';
  return [
    `${slug(name)}-almaq`,
    `${name} almaq | Premium hesab Azərbaycan - Mirpanel`,
    `${name} məhsulunu Mirpanel-də sərfəli qiymətə əldə et. Sürətli aktivləşdirmə və WhatsApp ilə rahat sifariş.`,
    `${name} almaq, ${name} ucuz, ${name} Azərbaycan, ${name} hesab almaq, premium hesab almaq, ucuz premium hesab`,
    `${name} üçün Mirpanel rahat sifariş və premium hesab aktivləşdirmə imkanı təqdim edir. Məhsulu Azərbaycanda sərfəli qiymətə əldə edə və sifarişi WhatsApp üzərindən tamamlaya bilərsiniz.`
  ];
}

function findObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${marker} not found`);
  const start = source.indexOf('{', markerIndex);
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
    }
  }
  throw new Error(`${marker} block not closed`);
}

function jsonString(value) { return JSON.stringify(String(value || '')); }

function replaceProperty(block, name, value) {
  const pattern = new RegExp(`("${name}"\\s*:\\s*)"([^"\\\\]|\\\\.)*"`);
  if (pattern.test(block)) return block.replace(pattern, `$1${jsonString(value)}`);
  return block.replace(/(\s+"flow"\s*:)/, `      "${name}": ${jsonString(value)},\n$1`);
}

let app = fs.readFileSync('app.js', 'utf8');
const dataBlock = findObject(app, 'const DATA');
const data = JSON.parse(dataBlock.text);

for (const product of data.products || []) {
  const [seoSlug, seoTitle, seoDescription, seoKeywords, seoContent] = seo[product.id] || generic(product);
  product.seoSlug = seoSlug;
  product.seoTitle = seoTitle;
  product.seoDescription = seoDescription;
  product.seoKeywords = seoKeywords;
  product.seoContent = seoContent;
}

let next = app;
for (const product of data.products || []) {
  const idNeedle = `"id": ${JSON.stringify(product.id)}`;
  const idIndex = next.indexOf(idNeedle);
  if (idIndex < 0) throw new Error(`Product not found: ${product.id}`);
  const start = next.lastIndexOf('{', idIndex);
  let depth = 0, quote = '', escaped = false, end = -1;
  for (let i = start; i < next.length; i += 1) {
    const ch = next[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  let block = next.slice(start, end + 1);
  for (const key of ['seoSlug','seoTitle','seoDescription','seoKeywords','seoContent']) {
    block = replaceProperty(block, key, product[key]);
  }
  next = next.slice(0, start) + block + next.slice(end + 1);
}
fs.writeFileSync('app.js', next, 'utf8');

const slugs = [];
for (const product of data.products || []) {
  if (product.active === false) continue;
  slugs.push(product.seoSlug);
  slugs.push(...(aliases[product.id] || []));
}
const unique = [...new Set(slugs.filter(Boolean))];
const urls = [`  <url><loc>https://mirpanel.com/</loc><lastmod>${TODAY}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`];
for (const item of unique) urls.push(`  <url><loc>https://mirpanel.com/${item}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, 'utf8');
fs.writeFileSync('_redirects', unique.map((item) => `/${item} /index.html 200`).join('\n') + '\n', 'utf8');

console.log(`SEO filled for ${data.products.length} products. Routes: ${unique.length}`);
