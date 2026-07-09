const STATIC_ASSET_RE = /\.(?:js|css|png|jpe?g|webp|svg|ico|gif|avif|xml|txt|json|map|woff2?|ttf|eot|pdf)$/i;

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

function wantsMarkdown(request) {
  const accept = request.headers.get("Accept") || "";
  return accept.toLowerCase().includes("text/markdown");
}

function isStaticAsset(pathname) {
  return STATIC_ASSET_RE.test(pathname);
}

function isHtmlLikePath(pathname) {
  if (pathname === "/" || pathname === "") return true;
  if (pathname.endsWith("/")) return true;
  return pathname.endsWith(".html");
}

function estimateTokens(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return String(Math.max(1, Math.ceil(words * 1.35)));
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!wantsMarkdown(request) || isStaticAsset(pathname) || !isHtmlLikePath(pathname)) {
    return context.next();
  }

  return new Response(MARKDOWN, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Vary": "Accept",
      "x-markdown-tokens": estimateTokens(MARKDOWN),
      "Link": "</.well-known/api-catalog>; rel=\"api-catalog\"; type=\"application/json\", </sitemap.xml>; rel=\"sitemap\"; type=\"application/xml\""
    }
  });
}
