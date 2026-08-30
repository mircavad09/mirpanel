const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const button = document.getElementById("loginBtn");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;

  errorBox.textContent = "";
  button.disabled = true;
  button.textContent = "Yoxlanılır...";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    });

    if (!/application\/json\b/i.test(response.headers.get("content-type") || "")) throw new Error("unavailable");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        response.status === 401 ? "İstifadəçi adı və ya şifrə yanlışdır." :
        response.status === 429 ? "Çox sayda giriş cəhdi olub. Bir qədər sonra yenidən cəhd edin." : "unavailable"
      );
    }
    if (payload?.ok !== true) throw new Error("unavailable");

    const next = new URLSearchParams(location.search).get("next");
    location.href = next && next.startsWith("/admin.html") ? next : "/admin.html";
  } catch (error) {
    errorBox.textContent = ["İstifadəçi adı və ya şifrə yanlışdır.", "Çox sayda giriş cəhdi olub. Bir qədər sonra yenidən cəhd edin."].includes(error.message)
      ? error.message : "Admin xidməti hazırda cavab vermir. Bir qədər sonra yenidən cəhd edin. Daxil etdiyiniz məlumatlar saxlanılıb.";
    button.disabled = false;
    button.textContent = "Daxil ol";
  } finally {
    clearTimeout(timer);
  }
});
