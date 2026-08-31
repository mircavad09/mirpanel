(function () {
  "use strict";

  const API_URL = "https://mirpanel.onrender.com/api/netflix/confirmation";
  const form = document.getElementById("netflixConfirmationForm");
  const input = document.getElementById("netflixConfirmationEmail");
  const button = form?.querySelector('button[type="submit"]');
  const status = document.getElementById("netflixConfirmationStatus");

  const messages = Object.freeze({
    unavailable: "Netflix təsdiqi xidməti hazırda əlçatan deyil.",
    rate_limited: "Çox tez-tez sorğu göndərildi. Bir qədər sonra yenidən cəhd edin.",
    connection_error: "Təsdiq xidmətinə qoşulmaq mümkün olmadı. Bir qədər sonra yenidən cəhd edin.",
    default: "Yeni uyğun təsdiq tapılmadı. Netflix-də e-poçtla təsdiq göndərilməsini seçib yenidən yoxlayın."
  });

  function show(message, error) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("is-error", Boolean(error));
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(input?.value || "").trim();
    if (!email || !input?.checkValidity()) {
      input?.focus();
      return;
    }
    button.disabled = true;
    show("Yoxlanılır…", false);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ email }),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("invalid_response");
      const result = await response.json();
      const key = result?.status;
      // The API response is intentionally never rendered: it could change in
      // the future, while this page must never expose a confirmation payload.
      show(messages[key] || messages.default, !response.ok || key !== "available");
    } catch {
      show(messages.connection_error, true);
    } finally {
      // Keep the address out of long-lived page state and browser form restore.
      if (input) input.value = "";
      button.disabled = false;
    }
  });
})();
