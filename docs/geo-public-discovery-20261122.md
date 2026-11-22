# Public discovery verification — 22 November 2026

Checks performed against live mirpanel.com on 22 November 2026 (Asia/Baku), independently of earlier reports. Implementation release: `90ca5ddf`. No commerce records, payments, training permissions or firewall settings were changed.

## Confirmed correction

The generated contact page retained the legacy `Mirpanel` title and a generic short description despite the current visible contact details. Contact metadata now consistently uses MirPanel, +994 51 411 35 45 and the existing support hours. A ContactPage entity links to the existing Organization. CMS processing cannot reintroduce the exact legacy defaults; intentional custom metadata remains intact. Live `/elaqe` returned 200 with the updated title, canonical, telephone and ContactPage markup after deployment.

## Indexability and content

- All 15 active product URLs returned 200 with substantive initial HTML, package information and existing FAQs. Fourteen are indexable. Telegram Premium intentionally remains noindex and absent from the sitemap.
- Netflix Şəxsi, Spotify, CapCut and Zoom: self canonicals, one H1, existing visible FAQ and offer data remain consistent. No new FAQ duplication, ratings, reviews, partnership claims or inferred guarantees were introduced.
- Root, catalog, robots and sitemap returned 200. The legacy Netflix alias redirects with 301; an unknown product returns 404/noindex. Profile requires authentication; cart remains noindex.
- Live Google Search Console URL inspection reported all four core product URLs indexed. Live Bing URL inspection also reported all four indexed. Sitemap acceptance was not counted as proof of indexing.
- Bing still displayed cached missing-alt/multiple-H1 warnings for some URLs; current initial and hydrated pages had one H1 and no images missing alt. A Zoom indexing refresh was requested and acknowledged; this does not prove a new crawl occurred.

## Bot access and the sampled 403

Cloudflare's current policy permits search crawling and disallows training. GPTBot and Google-Extended permissions were preserved. The local robots exclusions for private/admin/API pages were preserved.

The Cloudflare Perplexity event inspected in detail occurred on **21 November, 19:27:57 Baku**: Ray `a5e0b8af9d4b0193`, source `34.139.197.96`, request `www.mirpanel.com/.env.prod.bak`, claiming PerplexityBot. Cloudflare's rule “Block AI training crawlers for Bot Preference Sync disallow” blocked it. That source IP was absent from both official Perplexity published bot/user IP lists retrieved during this audit. This is not evidence that a verified Perplexity crawler was blocked from a public product page. No unsafe User-Agent-only exception was added.

The earlier historical 403 cannot be conclusively attributed without its corresponding request/Ray and retained event. Current 24-hour crawler summaries alone are insufficient, because claimed crawler names can include impersonation. Successful real search crawler activity and indexed core pages provide narrower evidence; changing a local User-Agent does not prove verified-bot access.

Official verification references:

- https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- https://www.perplexity.ai/perplexitybot.json
- https://www.perplexity.ai/perplexity-user.json
- https://developers.openai.com/api/docs/bots
- https://developers.google.com/search/docs/appearance/ai-features

## Automated and visual verification

Passed `test-geo-public-discovery.mjs`, `test-geo.mjs`, `test-seo.mjs` and the before/after live SEO audit. Browser checks passed 24 isolated product cases (Chrome at 320/390/430/1440 and WebKit at 390/1440), then 16 live product cases (Chrome/WebKit at 390/1440). Tests cover metadata surviving hydration, canonical/H1, horizontal overflow, package selection, existing rules and purchase-modal data. Non-GET production writes were blocked and quote responses isolated; real purchases: zero. Package selection assertions wait for the actual selected state to settle, avoiding a WebKit timing race.

## AI source measurement — no visibility gain claimed

Identical brand-free prompt used in fresh sessions on 22 November 2026:

> Azərbaycanda Netflix necə almaq olar? Cari variantları yoxla və istifadə etdiyin mənbələrin kliklənən keçidlərini göstər.

**ChatGPT:** unpersonalized temporary session, Web Search explicitly enabled, completed response. MirPanel was neither mentioned nor linked as a source. Actual answer links included:

- https://www.netflix.com/az/
- https://blueshop.az/az/qiymet/netflix
- https://hesablar.az/az/prices/netflix-qiymeti
- https://www.netflix.com/az/redeem

Observed session: https://chatgpt.com/c/6b02fc4b-eb74-83ed-837a-bbf003109446?temporary-chat=true (temporary-session retention/access is not guaranteed).

**Gemini:** new temporary chat, completed response. MirPanel was neither mentioned nor linked. Direct links included https://www.netflix.com/az/, https://www.g2a.com/, https://www.eneba.com/ and https://www.netflix.com/redeem. Two additional links were Google search URLs wrapping a Netflix help URL. The UI did not expose a search-grounding trace, so this is a completed answer/link observation, not a verified search-grounded citation measurement. The model's pricing and subscription claims were not adopted as MirPanel facts.

**Perplexity:** a fresh guest search began but a sign-in gate prevented a complete answer. No final citation result is claimed. Remaining requirement: access to an existing Perplexity account to complete the same query. No paid service or new account was purchased.

Technical eligibility and inclusion in an individual generated answer are separate. Immediate citation improvement is not established, and future inclusion is not guaranteed.
