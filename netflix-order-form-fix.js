(() => {
  const TOAST_ID = "netflixPinToast";
  const STYLE_ID = "netflixOrderFormFixStyles";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #modal.netflixOrderFormOpen .modalCard {
        border-color: rgba(229, 9, 20, .74) !important;
        background:
          radial-gradient(circle at 50% 0%, rgba(229, 9, 20, .18), transparent 42%),
          linear-gradient(180deg, rgba(18, 12, 13, .98), rgba(6, 6, 7, .98)) !important;
        box-shadow:
          0 26px 80px rgba(0, 0, 0, .66),
          0 0 38px rgba(229, 9, 20, .22) !important;
      }

      #modal.netflixOrderFormOpen .close {
        border-color: rgba(229, 9, 20, .22) !important;
        background: rgba(10, 10, 12, .72) !important;
      }

      .netflixOrderForm.premiumOrderForm {
        gap: 16px !important;
      }

      .netflixOrderForm .mpFormTitle {
        color: #ff2330 !important;
        background: linear-gradient(135deg, #fff 0%, #ff4b55 36%, #e50914 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: 0 0 28px rgba(229, 9, 20, .32) !important;
      }

      .netflixOrderSubtitle {
        margin: -4px 0 4px;
        color: rgba(255, 255, 255, .68);
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }

      .netflixOrderForm .universalField span {
        color: rgba(255, 238, 238, .94) !important;
      }

      .netflixOrderForm .universalField input {
        border-color: rgba(255, 255, 255, .16) !important;
        background: rgba(7, 7, 9, .86) !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, .045),
          0 12px 30px rgba(0, 0, 0, .26) !important;
      }

      .netflixOrderForm .universalField input:focus {
        border-color: rgba(229, 9, 20, .86) !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, .08),
          0 0 0 4px rgba(229, 9, 20, .13),
          0 0 30px rgba(229, 9, 20, .20) !important;
      }

      .netflixOrderForm input[name="code_4"] {
        text-align: center;
        letter-spacing: .34em;
        font-size: 20px !important;
        font-weight: 900 !important;
      }

      .netflixOrderForm .mpBtn:not(.orderConfirmationCancel) {
        background: linear-gradient(135deg, #ff3340, #e50914 58%, #9f050d) !important;
        box-shadow: 0 14px 34px rgba(229, 9, 20, .30), inset 0 1px 0 rgba(255, 255, 255, .18) !important;
      }

      .netflixOrderForm .orderConfirmationCancel {
        background: linear-gradient(135deg, rgba(54, 57, 66, .95), rgba(21, 23, 28, .96)) !important;
      }

      #${TOAST_ID} {
        position: fixed;
        top: calc(14px + env(safe-area-inset-top));
        left: 50%;
        z-index: 1000002;
        transform: translate(-50%, -16px);
        opacity: 0;
        pointer-events: none;
        max-width: min(420px, calc(100vw - 28px));
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid rgba(229, 9, 20, .48);
        background: linear-gradient(135deg, rgba(34, 7, 9, .98), rgba(7, 7, 9, .96));
        color: #fff;
        font: 800 13px/1.2 Poppins, system-ui, sans-serif;
        text-align: center;
        box-shadow: 0 16px 44px rgba(0, 0, 0, .46), 0 0 26px rgba(229, 9, 20, .20);
        transition: opacity .2s ease, transform .2s ease;
      }

      #${TOAST_ID}.show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function isCode4Form(form) {
    return Boolean(form?.querySelector('input[name="code_4"]'));
  }

  function decorateNetflixForm(form) {
    if (!isCode4Form(form) || form.dataset.netflixDecorated === "1") return;

    const modal = document.getElementById("modal");
    modal?.classList.add("netflixOrderFormOpen");
    form.classList.add("netflixOrderForm");
    form.dataset.netflixDecorated = "1";

    const title = form.querySelector(".mpFormTitle");
    if (title) {
      title.textContent = "Netflix profil məlumatları";
      if (!form.querySelector(".netflixOrderSubtitle")) {
        const subtitle = document.createElement("div");
        subtitle.className = "netflixOrderSubtitle";
        subtitle.textContent = "Profil adını və 4 rəqəmli otaq PIN kodunu qeyd edin.";
        title.insertAdjacentElement("afterend", subtitle);
      }
    }

    const nameInput = form.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.placeholder = nameInput.placeholder || "Profil adını yazın";
      nameInput.autocomplete = "name";
    }

    const codeInput = form.querySelector('input[name="code_4"]');
    if (codeInput) {
      codeInput.type = "text";
      codeInput.inputMode = "numeric";
      codeInput.maxLength = 4;
      codeInput.pattern = "\\d{4}";
      codeInput.autocomplete = "off";
      codeInput.placeholder = "••••";
      codeInput.setAttribute("aria-label", "4 rəqəmli otaq PIN kodu");
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 4);
    }
  }

  function cleanCodeInput(input) {
    const clean = input.value.replace(/\D/g, "").slice(0, 4);
    if (input.value !== clean) input.value = clean;
  }

  function activeCodeInput() {
    return document.querySelector('#universalOrderForm input[name="code_4"]');
  }

  injectStyles();

  const observer = new MutationObserver(() => {
    document.querySelectorAll("#universalOrderForm").forEach(decorateNetflixForm);
    if (!document.querySelector('#universalOrderForm input[name="code_4"]')) {
      document.getElementById("modal")?.classList.remove("netflixOrderFormOpen");
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("input", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    cleanCodeInput(input);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text") || "";
    input.value = text.replace(/\D/g, "").slice(0, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("#universalOrderForm");
    if (!isCode4Form(form)) return;

    const input = activeCodeInput();
    if (!input) return;
    cleanCodeInput(input);

    if (!/^\d{4}$/.test(input.value.trim())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast("Sadəcə 4 rəqəm yazmalısınız");
      input.focus();
    }
  }, true);
})();
