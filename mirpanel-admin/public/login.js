const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const button = document.getElementById("loginBtn");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorBox.textContent = "";
  button.disabled = true;
  button.textContent = "Yoxlanılır...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload.error ||
        "Giriş mümkün olmadı."
      );
    }

    location.href = "/admin.html";
  } catch (error) {
    errorBox.textContent = error.message;
    button.disabled = false;
    button.textContent = "Daxil ol";
  }
});