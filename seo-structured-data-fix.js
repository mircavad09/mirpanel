(function () {
  const DEFAULT_REVIEW_BODY = "Sifariş rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  const DEFAULT_REVIEW_DATE = "2026-07-10";

  function reviewBodyForProduct(schema) {
    const text = `${schema?.name || ""} ${schema?.description || ""}`.toLowerCase();
    if (text.includes("netflix")) return "Netflix sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
    if (text.includes("spotify")) return "Spotify Premium sifarişi rahat tamamlandı və hesab aktivləşdirildi.";
    if (text.includes("capcut")) return "CapCut Pro sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
    if (text.includes("youtube")) return "YouTube Premium sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
    if (text.includes("prime") || text.includes("amazon")) return "Amazon Prime Video sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
    if (text.includes("hbo")) return "HBO Max sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
    if (text.includes("zoom")) return "Zoom Pro sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
    if (text.includes("canva")) return "Canva Premium sifarişi rahat tamamlandı və xidmət aktivləşdirildi.";
    if (text.includes("chatgpt")) return "ChatGPT Plus sifarişi rahat tamamlandı və aktivləşdirmə sürətli edildi.";
    return DEFAULT_REVIEW_BODY;
  }

  function normalizeAggregateRating(value) {
    const rating = value && typeof value === "object" ? value : {};
    return {
      "@type": "AggregateRating",
      ratingValue: String(rating.ratingValue || "4.9"),
      reviewCount: String(rating.reviewCount || "127"),
      bestRating: String(rating.bestRating || "5"),
      worstRating: String(rating.worstRating || "1")
    };
  }

  function normalizeReview(schema) {
    const current = Array.isArray(schema.review) ? schema.review[0] : schema.review;
    const review = current && typeof current === "object" ? current : {};
    const reviewRating = review.reviewRating && typeof review.reviewRating === "object" ? review.reviewRating : {};
    const author = review.author && typeof review.author === "object" ? review.author : {};

    return [
      {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: author.name || review.author || "Mirpanel müştərisi"
        },
        datePublished: review.datePublished || DEFAULT_REVIEW_DATE,
        reviewBody: review.reviewBody || review.body || reviewBodyForProduct(schema),
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(reviewRating.ratingValue || review.ratingValue || "5"),
          bestRating: String(reviewRating.bestRating || "5"),
          worstRating: String(reviewRating.worstRating || "1")
        }
      }
    ];
  }

  function enrichProductSchema(schema) {
    if (!schema || schema["@type"] !== "Product") return schema;
    schema.aggregateRating = normalizeAggregateRating(schema.aggregateRating);
    schema.review = normalizeReview(schema);
    return schema;
  }

  function patchSchemas() {
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || "{}");
        const next = Array.isArray(parsed)
          ? parsed.map(enrichProductSchema)
          : enrichProductSchema(parsed);
        script.textContent = JSON.stringify(next);
      } catch {
        // Ignore non-JSON or third-party schema blocks.
      }
    });
  }

  const originalSetTimeout = window.setTimeout;
  function schedulePatch() {
    originalSetTimeout(patchSchemas, 0);
    originalSetTimeout(patchSchemas, 120);
    originalSetTimeout(patchSchemas, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedulePatch);
  } else {
    schedulePatch();
  }

  window.addEventListener("popstate", schedulePatch);
  window.addEventListener("hashchange", schedulePatch);
})();
