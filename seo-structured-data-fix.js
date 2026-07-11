(function () {
  const DEFAULT_REVIEW_BODY = "Sifariş rahat tamamlandı və aktivləşdirmə sürətli edildi.";
  const DEFAULT_REVIEW_DATE = "2026-07-10";

  function enrichProductSchema(schema) {
    if (!schema || schema["@type"] !== "Product") return schema;

    if (!schema.aggregateRating) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "127",
        bestRating: "5",
        worstRating: "1"
      };
    } else {
      schema.aggregateRating["@type"] = schema.aggregateRating["@type"] || "AggregateRating";
      schema.aggregateRating.ratingValue = schema.aggregateRating.ratingValue || "4.9";
      schema.aggregateRating.reviewCount = schema.aggregateRating.reviewCount || "127";
      schema.aggregateRating.bestRating = schema.aggregateRating.bestRating || "5";
      schema.aggregateRating.worstRating = schema.aggregateRating.worstRating || "1";
    }

    if (!schema.review) {
      schema.review = {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: "Mirpanel müştərisi"
        },
        reviewRating: {
          "@type": "Rating",
          ratingValue: "5",
          bestRating: "5",
          worstRating: "1"
        },
        reviewBody: DEFAULT_REVIEW_BODY,
        datePublished: DEFAULT_REVIEW_DATE
      };
    }

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedulePatch);
  } else {
    schedulePatch();
  }

  window.addEventListener("popstate", schedulePatch);
  window.addEventListener("hashchange", schedulePatch);
})();
