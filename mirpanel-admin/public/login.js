const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const button = document.getElementById("loginBtn");

if (new URLSearchParams(location.search).get("reason") === "session_required") {
  errorBox.textContent = "Admin sessiyası təsdiqlənmədi. Bu, şifrənin yanlış olduğu demək deyil. Yenidən giriş cəhdi zamanı sessiya ayrıca yoxlanılacaq.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;

  errorBox.textContent = "";
  errorBox.removeAttribute("data-login-status");
  errorBox.removeAttribute("data-session-status");
  button.disabled = true;
  button.textContent = "Yoxlanılır...";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    });

    errorBox.setAttribute("data-login-status", String(response.status));
    if (!/application\/json\b/i.test(response.headers.get("content-type") || "")) throw new Error("unavailable");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        response.status === 401 ? "İstifadəçi adı və ya şifrə yanlışdır." :
        response.status === 429 ? "Çox sayda giriş cəhdi olub. Bir qədər sonra yenidən cəhd edin." : "unavailable"
      );
    }
    if (payload?.ok !== true) throw new Error("unavailable");

    // Verify that the browser returns the HttpOnly session cookie before navigating.
    // Neither credentials nor cookie/token values are logged or added to the DOM.
    button.textContent = "Sessiya yoxlanılır...";
    const sessionResponse = await fetch("/api/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    errorBox.setAttribute("data-session-status", String(sessionResponse.status));
    if (!/application\/json\b/i.test(sessionResponse.headers.get("content-type") || "")) throw new Error("unavailable");
    const session = await sessionResponse.json();
    if (sessionResponse.status === 401 && session?.code === "ADMIN_SESSION_REQUIRED") {
      throw Object.assign(new Error(session.reason === "cookie_not_received"
        ? "Giriş məlumatları düzgündür, amma brauzer sessiya cookie-sini serverə göndərmədi. Panelə keçid dayandırıldı."
        : "Giriş məlumatları düzgündür, amma server yaradılmış sessiyanı tapa bilmədi. Panelə keçid dayandırıldı; yenidən cəhd edin."), { sessionFailure: true });
    }
    if (!sessionResponse.ok || session?.ok !== true) throw new Error("unavailable");

    const next = new URLSearchParams(location.search).get("next");
    location.href = next && next.startsWith("/admin.html") ? next : "/admin.html";
  } catch (error) {
    errorBox.textContent = error.sessionFailure || ["İstifadəçi adı və ya şifrə yanlışdır.", "Çox sayda giriş cəhdi olub. Bir qədər sonra yenidən cəhd edin."].includes(error.message)
      ? error.message : "Admin xidməti hazırda cavab vermir. Bir qədər sonra yenidən cəhd edin. Daxil etdiyiniz məlumatlar saxlanılıb.";
    button.disabled = false;
    button.textContent = "Daxil ol";
  } finally {
    clearTimeout(timer);
  }
});
