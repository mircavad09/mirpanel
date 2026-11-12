(() => {
  const DEFAULT_CONFIRMATION = {
    enabled: false,
    title: "Diqqət!",
    description: "",
    confirmText: "Oxudum və təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "",
    helpLink: { enabled: false, label: "", url: "" }
  };
  const DEFAULT_AGREEMENT_TEXT = "İstifadə qaydalarını və şərtləri oxudum, qəbul edirəm.";
  const AGREEMENT_LINK_TEXT = "İstifadə qaydalarını və şərtləri";
  const AGREEMENT_ERROR = "Davam etmək üçün istifadə qaydalarını və şərtləri qəbul edin.";
  const DEFAULT_SPOTIFY_RESET_URL = "https://accounts.spotify.com/az/password-reset";
  let orderTermsAccepted = false;
  let modalSession = 0;
  let cartOpening, cartModule, cartModuleRetry = 0;
  function entryModule() {
    if (!cartModule) cartModule = import("/community-assets/cart-entry.js?v=epinby-account-1" + (cartModuleRetry ? "&retry=" + cartModuleRetry : ""))
      .catch(error => {cartModule = null; cartModuleRetry++; throw error;});
    return cartModule;
  }

  function prefetchSelectedTerms() {
    if (typeof currentProduct === "undefined" || !currentProduct || !document.getElementById("pp-order-btn")) return;
    const product = currentProduct, plan = selectedPlan(product);
    if (Number(plan?.price) > 0) void entryModule().then(m => m.prepareCartEntry(product, plan)).catch(() => {});
  }

  function openPreparedCartEntry(product, plan, loginOnGuest) {
    if (cartOpening?.open || document.querySelector("dialog.cart-entry[open]")) return;
    const life = new AbortController(), dialog = document.createElement("dialog"), title = document.createElement("h2"),
      close = document.createElement("button"), status = document.createElement("p"), retry = document.createElement("button");
    dialog.className = "cart-entry";
    dialog.setAttribute("aria-label", "Diqqət!");
    dialog.style.cssText = "box-sizing:border-box;width:min(520px,calc(100% - 28px));padding:18px;background:#181b1e;color:#fff;border:1px solid #66552c;border-radius:16px";
    title.textContent = "Diqqət!";
    close.type = retry.type = "button";
    close.textContent = "Bağla"; retry.textContent = "Yenidən cəhd et";
    close.onclick = () => dialog.close();
    status.setAttribute("role", "status"); status.setAttribute("aria-label", "Qaydalar hazırlanır"); retry.hidden = true;
    dialog.append(title, status, retry, close);
    let handedOff = false;
    cartOpening = dialog;
    window.addEventListener("mirpanel:before-navigate", e => {if (dialog.open) e.preventDefault();}, {signal:life.signal});
    dialog.addEventListener("close", () => {
      life.abort();
      if (handedOff) return;
      dialog.remove();
      if (cartOpening === dialog) {cartOpening = null; document.body.classList.remove("orderConfirmationActive");}
    }, {once:true});
    document.body.append(dialog); dialog.showModal(); document.body.classList.add("orderConfirmationActive");
    async function load() {
      retry.hidden = true; status.textContent = "";
      status.setAttribute("aria-busy", "true");
      status.style.cssText = "display:block;min-height:54px;background:linear-gradient(#303337,#303337) 0 4px/95% 9px no-repeat,linear-gradient(#303337,#303337) 0 23px/81% 9px no-repeat,linear-gradient(#303337,#303337) 0 42px/57% 9px no-repeat";
      let timer;
      try {
        const m = await Promise.race([
          entryModule(),
          new Promise((_, reject) => {timer = setTimeout(() => {cartModule = null; cartModuleRetry++; reject(Error("Order module timeout"));}, 12000);})
        ]);
        if (!dialog.open || cartOpening !== dialog) return;
        await m.startCartEntry(product, plan, {loginOnGuest, loadingDialog:dialog, onReady:() => {handedOff = true; cartOpening = null; life.abort();}});
      } catch {
        if (dialog.open && cartOpening === dialog) {
          status.removeAttribute("style"); status.setAttribute("aria-busy", "false"); status.removeAttribute("aria-label");
          status.textContent = "Sifariş pəncərəsini açmaq mümkün olmadı.";
          retry.hidden = false;
        }
      } finally {clearTimeout(timer);}
    }
    retry.onclick = load;
    void load();
  }

  function publicProductTitle(value) {
    return String(value || "").replace(/\s+almaq\s*$/i, "").trim();
  }

  const ORDER_FLOWS = new Set([
    "direct_whatsapp",
    "form_then_whatsapp",
    "confirm_then_whatsapp",
    "form_confirm_whatsapp"
  ]);

  const LEGACY_FLOW_FIELDS = {
    name_code_4: [
      { key: "name", type: "text", label: "Ad", placeholder: "Adınızı yazın", required: true, enabled: true },
      { key: "code_4", type: "text", label: "4 rəqəmli kod / PIN", placeholder: "4 rəqəmli kod yazın", required: true, enabled: true }
    ],
    name_code_5: [
      { key: "name", type: "text", label: "Ad", placeholder: "Adınızı yazın", required: true, enabled: true },
      { key: "code_5", type: "text", label: "5 rəqəmli kod / PIN", placeholder: "5 rəqəmli kod yazın", required: true, enabled: true }
    ],
    email: [
      { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ünvanınızı yazın", required: true, enabled: true }
    ],
    spotify: [
      { key: "email", type: "email", label: "Gmail ünvanınız", placeholder: "Gmail ünvanınızı yazın", required: true, enabled: true },
      { key: "password", type: "password", label: "Spotify şifrəniz", placeholder: "Spotify şifrənizi yazın", required: true, enabled: true },
      { key: "password_confirm", type: "password", label: "Spotify şifrənizi təkrar yazın", placeholder: "Şifrənizi yenidən yazın", required: true, enabled: true }
    ]
  };

  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";
  const STOCK_ENDPOINT = "/api/decrement-stock";

  function injectOrderStyles() {
    if (document.getElementById("mirpanelOrderRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "mirpanelOrderRuntimeStyles";
    style.textContent = `
      #modal.premiumOrderFormOpen .modalCard {
        width: min(540px, calc(100vw - 28px));
        border: 1px solid rgba(34, 211, 119, .72);
        background: radial-gradient(circle at 50% 0%, rgba(34, 211, 119, .12), transparent 38%), linear-gradient(180deg, rgba(18, 24, 21, .98), rgba(7, 9, 8, .98));
        box-shadow: 0 26px 80px rgba(0, 0, 0, .62), 0 0 34px rgba(34, 211, 119, .18);
      }

      #modal.premiumOrderFormOpen .mTop,
      #modal.premiumOrderFormOpen .mPlansTitle,
      #modal.premiumOrderFormOpen .mPlans,
      #modal.premiumOrderFormOpen .mInfoBox,
      #modal.premiumOrderFormOpen #mDesc { display: none !important; }
      #modal.premiumOrderFormOpen #mForm { margin-top: 0 !important; }
      #modal.premiumOrderFormOpen .mBottom { margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, .08); }
      #modal.premiumOrderFormOpen #mInfo { color: rgba(255, 255, 255, .92); font-size: 17px; font-weight: 800; text-align: center; }
      #modal.premiumOrderFormOpen .mSmall { display: none; }
      #modal.premiumOrderFormOpen .close { width: 32px; height: 32px; padding: 0; font-size: 23px; }

      .universalOrderForm.premiumOrderForm { display: grid; gap: 18px; padding: 28px 2px 0; }
      .premiumOrderForm .mpFormTitle {
        margin: 0 0 8px; text-align: center; font-size: clamp(24px, 4vw, 30px); font-weight: 900; line-height: 1.15; letter-spacing: 0;
        color: #2dff86; background: linear-gradient(135deg, #c9ffe1 0%, #2dff86 45%, #13b87c 100%);
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 24px rgba(45, 255, 134, .22);
      }
      .premiumOrderForm .premiumOrderFields { display: grid; gap: 14px; }
      .orderFormProduct { margin: -8px 0 0; color: rgba(235,255,243,.76); text-align: center; font-size: 13px; line-height: 1.35; }
      .premiumOrderForm .universalField { display: grid; gap: 8px; margin: 0; }
      .premiumOrderForm .universalField span { color: rgba(235, 255, 243, .9); font-size: 13px; font-weight: 800; }
      .premiumOrderForm .universalField input,
      .premiumOrderForm .spotifyPasswordControl input,
      .premiumOrderForm .universalField textarea {
        width: 100%; min-height: 52px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, .28); background: rgba(3, 8, 7, .74);
        color: #f7fff9; font-family: inherit; font-size: 15px; font-weight: 600; outline: none; padding: 14px 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 12px 30px rgba(0, 0, 0, .22);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, transform .18s ease;
      }
      .premiumOrderForm .universalField textarea { min-height: 112px; resize: vertical; }
      .premiumOrderForm .universalField input::placeholder,
      .premiumOrderForm .spotifyPasswordControl input::placeholder,
      .premiumOrderForm .universalField textarea::placeholder { color: rgba(226, 232, 240, .48); font-weight: 500; }
      .premiumOrderForm .universalField input:focus,
      .premiumOrderForm .spotifyPasswordControl input:focus,
      .premiumOrderForm .universalField textarea:focus {
        border-color: rgba(45, 255, 134, .78); background: rgba(4, 13, 10, .92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(45, 255, 134, .1), 0 0 28px rgba(45, 255, 134, .16);
      }
      .premiumOrderForm .orderConfirmationActions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
      .premiumOrderForm .mpBtn { min-height: 56px; border: 0; border-radius: 16px; color: #f8fff9; font-family: inherit; font-size: 16px; font-weight: 900; cursor: pointer; transition: transform .18s ease, box-shadow .2s ease, filter .2s ease, background .2s ease; }
      .premiumOrderForm .mpBtn:not(.orderConfirmationCancel) { background: linear-gradient(135deg, #2dde7d, #12a978); box-shadow: 0 14px 34px rgba(18, 169, 120, .28), inset 0 1px 0 rgba(255, 255, 255, .2); }
      .premiumOrderForm .orderConfirmationCancel { background: linear-gradient(135deg, rgba(71, 85, 105, .95), rgba(38, 48, 63, .95)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08); }
      .premiumOrderForm .mpBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .premiumOrderForm .mpBtn:active { transform: translateY(1px) scale(.99); }
      .spotifyCredentialsForm { gap: 14px !important; }
      .spotifyCredentialsForm .premiumOrderFields { gap: 12px; }
      .spotifyPasswordField { display: grid; gap: 8px; margin: 0; }
      .spotifyPasswordField > span:first-child { color: rgba(235, 255, 243, .9); font-size: 13px; font-weight: 800; }
      .spotifyPasswordControl { position: relative; min-width: 0; }
      .spotifyPasswordControl input { width: 100%; padding-right: 60px !important; }
      .spotifyPasswordToggle {
        position: absolute; z-index: 1; top: 50%; right: 4px; transform: translateY(-50%); display: grid; place-items: center;
        width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0; border: 1px solid rgba(45, 255, 134, .28); border-radius: 12px; cursor: pointer;
        color: #8fffc0; background: rgba(10, 37, 25, .94); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .spotifyPasswordToggle:hover, .spotifyPasswordToggle:focus-visible { color: #d7ffe8; background: rgba(24, 95, 61, .96); outline: 2px solid rgba(45, 255, 134, .56); outline-offset: 1px; }
      .spotifyPasswordToggle svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .spotifyPasswordError { margin: -3px 0 0; color: #ff9e9e; font-size: 12px; font-weight: 750; line-height: 1.4; }
      .spotifyPasswordReset { margin: -2px 0 0; color: rgba(235, 255, 243, .68); font-size: 13px; line-height: 1.45; }
      .spotifyPasswordReset a { color: #45e884; font-weight: 850; text-underline-offset: 3px; }
      .spotifyCredentialsHint { margin: 0; color: #d6ecdf; font-size: 12px; line-height: 1.4; overflow-wrap: anywhere; }
      .spotifyCredentialsForm .premiumContinueBtn:disabled { cursor: not-allowed; opacity: .42; filter: saturate(.35); box-shadow: none; transform: none; }
      @media (max-width: 390px) {
        .spotifyCredentialsForm { padding-top: 19px !important; gap: 12px !important; }
        .spotifyCredentialsForm .premiumOrderFields { gap: 10px; }
        .spotifyCredentialsForm .universalField input, .spotifyCredentialsForm .spotifyPasswordField input { min-height: 50px; font-size: 16px; }
        .spotifyCredentialsForm .orderConfirmationActions { grid-template-columns: 1fr 1fr; gap: 9px; }
        .spotifyCredentialsForm .mpBtn { min-height: 50px; font-size: 14px; }
      }

      #modal.netflixPersonalFormOpen {
        backdrop-filter: blur(18px) saturate(.82);
        -webkit-backdrop-filter: blur(18px) saturate(.82);
      }
      #modal.netflixPersonalFormOpen .modalCard {
        width: min(520px, calc(100vw - 32px)) !important;
        max-width: calc(100vw - 32px) !important;
        border: 1px solid rgba(229, 9, 20, .38);
        border-radius: 24px;
        background:
          radial-gradient(circle at 14% -8%, rgba(229, 9, 20, .19), transparent 38%),
          linear-gradient(155deg, rgba(18, 18, 21, .985), rgba(5, 5, 7, .99));
        box-shadow: 0 30px 90px rgba(0, 0, 0, .72), 0 0 34px rgba(229, 9, 20, .12), inset 0 1px 0 rgba(255, 255, 255, .055);
        padding: 24px;
      }
      #modal.netflixPersonalFormOpen .mTop,
      #modal.netflixPersonalFormOpen .mPlansTitle,
      #modal.netflixPersonalFormOpen .mPlans,
      #modal.netflixPersonalFormOpen .mInfoBox,
      #modal.netflixPersonalFormOpen #mDesc,
      #modal.netflixPersonalFormOpen .mBottom { display: none !important; }
      #modal.netflixPersonalFormOpen #mForm { margin-top: 0 !important; }
      #modal.netflixPersonalFormOpen .close {
        top: 17px; right: 17px; z-index: 4; width: 36px; height: 36px; padding: 0;
        border: 1px solid rgba(255, 255, 255, .1); border-radius: 12px; background: rgba(255, 255, 255, .055);
        color: rgba(255, 255, 255, .76); font-size: 25px; font-weight: 400; line-height: 1;
      }
      #modal.netflixPersonalFormOpen .close:hover,
      #modal.netflixPersonalFormOpen .close:focus-visible { border-color: rgba(229, 9, 20, .48); color: #fff; box-shadow: 0 0 0 3px rgba(229, 9, 20, .1); }
      .netflixPersonalForm { display: grid; gap: 18px; padding-top: 0; }
      .netflixPersonalHeader { display: grid; gap: 16px; padding-right: 42px; }
      .netflixPersonalTopline { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .netflixPersonalLogo {
        width: 32px; height: 32px; flex: 0 0 32px; object-fit: contain; border-radius: 9px;
        background: #070707; box-shadow: 0 0 18px rgba(229, 9, 20, .2);
      }
      .netflixPersonalEyebrow { color: #ff5a62; font-size: 11px; line-height: 1.2; font-weight: 850; letter-spacing: .12em; white-space: nowrap; }
      .netflixPersonalPrice {
        margin-left: auto; flex: 0 0 auto; padding: 7px 10px; border: 1px solid rgba(229, 9, 20, .32); border-radius: 999px;
        background: rgba(229, 9, 20, .105); color: #fff; font-size: 13px; line-height: 1; font-weight: 850;
      }
      .netflixPersonalTitle { margin: 0; color: #fff; font-size: clamp(24px, 5vw, 31px); line-height: 1.12; font-weight: 880; letter-spacing: -.025em; }
      .netflixPersonalIntro { margin: -8px 0 0; color: rgba(244, 244, 245, .75); font-size: 14px; line-height: 1.55; }
      .netflixPersonalIntro strong { color: #fff; font-weight: 800; }
      .netflixPersonalFields { display: grid; gap: 16px; }
      .netflixPersonalField { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
      .netflixPersonalFieldLabel { color: rgba(255, 255, 255, .92); font-size: 13px; line-height: 1.3; font-weight: 800; }
      .netflixPersonalField input:not(.netflixPinSource) {
        width: 100%; min-height: 54px; padding: 14px 16px; border: 1px solid rgba(255, 255, 255, .13); border-radius: 15px;
        outline: none; background: rgba(2, 2, 4, .72); color: #fff; font: 650 16px/1.2 inherit;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035); transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .netflixPersonalField input:not(.netflixPinSource)::placeholder { color: rgba(255, 255, 255, .36); font-weight: 500; }
      .netflixPersonalField input:not(.netflixPinSource):focus { border-color: rgba(229, 9, 20, .72); background: rgba(9, 3, 4, .88); box-shadow: 0 0 0 4px rgba(229, 9, 20, .1), 0 0 24px rgba(229, 9, 20, .1); }
      .netflixPersonalHelp { margin: 0; color: rgba(228, 228, 231, .57); font-size: 12px; line-height: 1.45; }
      .netflixPinSource { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; }
      .netflixPinBoxes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; max-width: 310px; }
      .netflixPinBoxes .netflixPinDigit {
        min-width: 0; width: 100%; height: 58px; min-height: 58px; padding: 0 !important; text-align: center;
        border-radius: 15px !important; font-size: 22px !important; font-weight: 850 !important; font-variant-numeric: tabular-nums;
      }
      .netflixPersonalNote { margin: -2px 0 0; padding: 10px 12px; border-left: 2px solid rgba(229, 9, 20, .62); border-radius: 0 10px 10px 0; background: rgba(229, 9, 20, .055); color: rgba(255, 255, 255, .72); font-size: 12px; line-height: 1.4; }
      .netflixPersonalActions { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin-top: 0; }
      .netflixPersonalActions .mpBtn { min-height: 52px; border-radius: 14px; font: 850 15px/1 inherit; transition: transform .18s ease, filter .18s ease, opacity .18s ease, box-shadow .18s ease; }
      .netflixPersonalActions .orderConfirmationCancel { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .055); color: rgba(255, 255, 255, .8); }
      .netflixPersonalActions .netflixContinueBtn { border: 1px solid rgba(255, 93, 101, .24); background: linear-gradient(135deg, #e50914, #a90810); color: #fff; box-shadow: 0 14px 30px rgba(229, 9, 20, .22), inset 0 1px 0 rgba(255, 255, 255, .18); }
      .netflixPersonalActions .netflixContinueBtn:disabled { cursor: not-allowed; opacity: .42; filter: saturate(.45); box-shadow: none; }
      .netflixPersonalActions .mpBtn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.06); }
      @media (max-width: 390px) {
        #modal.netflixPersonalFormOpen { inset: var(--netflix-vv-top, 0px) 0 auto; height: var(--netflix-vv-height, 100dvh); padding: max(8px, env(safe-area-inset-top, 0px)) 8px max(8px, env(safe-area-inset-bottom, 0px)); overflow: hidden; overscroll-behavior: none; }
        #modal.netflixPersonalFormOpen .modalCard { width: calc(100vw - 24px) !important; padding: 14px 14px 12px; border-radius: 20px; max-height: calc(100vh - 16px); max-height: calc(var(--netflix-vv-height, 100dvh) - max(16px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))); overflow: hidden; }
        .netflixPersonalForm { gap: 9px; }
        .netflixPersonalHeader { gap: 7px; padding-right: 32px; }
        .netflixPersonalTopline { gap: 8px; }
        .netflixPersonalLogo { width: 29px; height: 29px; flex-basis: 29px; }
        .netflixPersonalEyebrow { font-size: 9px; letter-spacing: .085em; }
        .netflixPersonalPrice { padding: 6px 8px; font-size: 11px; }
        .netflixPersonalTitle { font-size: 21px; line-height: 1.08; }
        .netflixPersonalIntro { margin-top: -2px; font-size: 12px; line-height: 1.38; }
        .netflixPersonalFields { gap: 9px; }
        .netflixPersonalField { gap: 5px; }
        .netflixPersonalField input:not(.netflixPinSource) { min-height: 46px; padding: 11px 13px; font-size: 15px; }
        .netflixPersonalHelp { font-size: 11px; line-height: 1.25; }
        .netflixPinBoxes { gap: 7px; max-width: none; }
        .netflixPinBoxes .netflixPinDigit { height: 46px; min-height: 46px; font-size: 20px !important; }
        .netflixPersonalActions .mpBtn { min-height: 48px; font-size: 14px; }
        body.netflixKeyboardOpen #modal.netflixPersonalFormOpen { align-items: flex-end; }
        body.netflixKeyboardOpen .netflixPersonalHeader, body.netflixKeyboardOpen .netflixPersonalHelp { display: none; }
        body.netflixKeyboardOpen #modal.netflixPersonalFormOpen .modalCard { padding: 10px 12px; }
        body.netflixKeyboardOpen .netflixPersonalForm, body.netflixKeyboardOpen .netflixPersonalFields { gap: 6px; }
        body.netflixKeyboardOpen .netflixPersonalField input:not(.netflixPinSource), body.netflixKeyboardOpen .netflixPinBoxes .netflixPinDigit { min-height: 42px; height: 42px; }
      }
      @media (prefers-reduced-motion: reduce) {
        #modal.netflixPersonalFormOpen .modalCard, #modal.netflixPersonalFormOpen .mpBtn, #modal.netflixPersonalFormOpen input { transition: none !important; animation: none !important; }
        #modal.netflixPersonalFormOpen .modalCard { box-shadow: 0 24px 70px rgba(0, 0, 0, .68); }
      }

      #modal.hboMaxOrderFormOpen .modalCard {
        width: min(540px, calc(100vw - 28px));
        border: 1px solid rgba(122, 92, 255, .74);
        background:
          radial-gradient(circle at 22% 0%, rgba(122, 92, 255, .24), transparent 42%),
          radial-gradient(circle at 88% 14%, rgba(34, 211, 238, .15), transparent 36%),
          linear-gradient(180deg, rgba(11, 13, 26, .98), rgba(5, 7, 15, .99));
        box-shadow: 0 26px 80px rgba(0, 0, 0, .66), 0 0 38px rgba(122, 92, 255, .20), 0 0 28px rgba(34, 211, 238, .10);
      }

      #modal.hboMaxOrderFormOpen .mTop,
      #modal.hboMaxOrderFormOpen .mPlansTitle,
      #modal.hboMaxOrderFormOpen .mPlans,
      #modal.hboMaxOrderFormOpen .mInfoBox,
      #modal.hboMaxOrderFormOpen #mDesc { display: none !important; }
      #modal.hboMaxOrderFormOpen #mForm { margin-top: 0 !important; }
      #modal.hboMaxOrderFormOpen .mBottom { margin-top: 14px; padding-top: 11px; border-top: 1px solid rgba(122, 92, 255, .20); }
      #modal.hboMaxOrderFormOpen #mInfo { color: rgba(245, 248, 255, .94); font-size: 16px; font-weight: 900; text-align: center; }
      #modal.hboMaxOrderFormOpen .mSmall { display: none; }

      .hboMaxOrderForm {
        display: grid;
        gap: 16px;
        padding: 25px 2px 0;
      }
      .hboMaxOrderForm .mpFormTitle {
        margin: 0;
        text-align: center;
        font-size: clamp(24px, 4vw, 30px);
        line-height: 1.1;
        font-weight: 950;
        color: #a78bfa;
        background: linear-gradient(135deg, #f1f5ff 0%, #a78bfa 45%, #22d3ee 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 26px rgba(122, 92, 255, .24);
      }
      .hboMaxOrderForm .hboMaxOrderHint {
        margin: -5px 0 2px;
        color: rgba(226, 232, 255, .72);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 650;
        text-align: center;
      }
      .hboMaxOrderForm .premiumOrderFields {
        display: grid;
        gap: 13px;
      }
      .hboMaxOrderForm .universalField {
        display: grid;
        gap: 8px;
        margin: 0;
      }
      .hboMaxOrderForm .universalField span {
        color: rgba(235, 240, 255, .9);
        font-size: 13px;
        font-weight: 850;
      }
      .hboMaxOrderForm .universalField input,
      .hboMaxOrderForm .universalField textarea {
        width: 100%;
        min-height: 52px;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 255, .34);
        background: rgba(3, 7, 18, .76);
        color: #f8fbff;
        font-family: inherit;
        font-size: 15px;
        font-weight: 650;
        outline: none;
        padding: 14px 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 12px 30px rgba(0, 0, 0, .24);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease;
      }
      .hboMaxOrderForm .universalField input::placeholder,
      .hboMaxOrderForm .universalField textarea::placeholder {
        color: rgba(226, 232, 240, .48);
      }
      .hboMaxOrderForm .universalField input:focus,
      .hboMaxOrderForm .universalField textarea:focus {
        border-color: rgba(34, 211, 238, .78);
        background: rgba(5, 11, 26, .92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(34, 211, 238, .10), 0 0 30px rgba(122, 92, 255, .18);
      }
      .hboMaxOrderForm .orderConfirmationActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 4px;
      }
      .hboMaxOrderForm .mpBtn {
        min-height: 54px;
        border: 0;
        border-radius: 16px;
        color: #f8fbff;
        font-family: inherit;
        font-size: 16px;
        font-weight: 950;
        cursor: pointer;
        transition: transform .18s ease, box-shadow .2s ease, filter .2s ease;
      }
      .hboMaxOrderForm .mpBtn:not(.orderConfirmationCancel) {
        background: linear-gradient(135deg, #7c3aed, #2563eb 55%, #06b6d4);
        box-shadow: 0 15px 36px rgba(37, 99, 235, .27), 0 0 24px rgba(34, 211, 238, .14), inset 0 1px 0 rgba(255, 255, 255, .18);
      }
      .hboMaxOrderForm .orderConfirmationCancel {
        background: linear-gradient(135deg, rgba(55, 65, 81, .96), rgba(24, 31, 48, .96));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .hboMaxOrderForm .mpBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .hboMaxOrderForm .mpBtn:active { transform: translateY(1px) scale(.99); }

      .mpStockLine { margin-top: 12px; }
      .mpStockBadge {
        display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 9px 13px; border-radius: 999px;
        font-size: 13px; font-weight: 900; line-height: 1; letter-spacing: 0; white-space: nowrap;
        border: 1px solid rgba(45, 255, 134, .38); color: #dcffe9;
        background: linear-gradient(135deg, rgba(19, 185, 116, .22), rgba(8, 20, 15, .86));
        box-shadow: 0 10px 28px rgba(24, 210, 130, .14), inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .mpStockBadge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #35ff8f; box-shadow: 0 0 12px rgba(53, 255, 143, .8); flex: 0 0 auto; }
      .mpStockBadge.low { border-color: rgba(255, 186, 73, .45); color: #fff3ce; background: linear-gradient(135deg, rgba(255, 184, 53, .2), rgba(32, 20, 5, .86)); box-shadow: 0 10px 28px rgba(255, 184, 53, .14), inset 0 1px 0 rgba(255, 255, 255, .08); }
      .mpStockBadge.low::before { background: #ffbd4a; box-shadow: 0 0 12px rgba(255, 189, 74, .8); }
      .mpStockBadge.out { border-color: rgba(255, 96, 96, .42); color: #ffd5d5; background: linear-gradient(135deg, rgba(255, 70, 70, .18), rgba(29, 6, 8, .9)); box-shadow: 0 10px 28px rgba(255, 70, 70, .13), inset 0 1px 0 rgba(255, 255, 255, .06); }
      .mpStockBadge.out::before { background: #ff5b5b; box-shadow: 0 0 12px rgba(255, 91, 91, .75); }

      #modal.spotifyConfirmationModal {
        align-items: center;
      }
      #modal.spotifyConfirmationModal .modalCard {
        width: min(520px, calc(100vw - 28px));
        max-height: calc(100dvh - 120px);
        overflow-y: auto;
        border: 1px solid rgba(30, 215, 96, .62);
        background: radial-gradient(circle at 50% 0%, rgba(30, 215, 96, .16), transparent 42%), linear-gradient(180deg, rgba(10, 20, 15, .98), rgba(5, 7, 6, .98));
        box-shadow: 0 22px 70px rgba(0, 0, 0, .66), 0 0 34px rgba(30, 215, 96, .18);
      }
      #modal.spotifyConfirmationModal .mTop,
      #modal.spotifyConfirmationModal .mPlansTitle,
      #modal.spotifyConfirmationModal .mPlans,
      #modal.spotifyConfirmationModal .mInfoBox,
      #modal.spotifyConfirmationModal #mDesc {
        display: none !important;
      }
      #modal.spotifyConfirmationModal #mForm {
        margin-top: 0 !important;
      }
      #modal.spotifyConfirmationModal .mBottom {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, .08);
      }
      #modal.spotifyConfirmationModal .mSmall {
        color: rgba(235, 255, 243, .64);
        font-size: 12px;
        line-height: 1.35;
        text-align: center;
      }
      .spotifyConfirmationModal .orderConfirmation {
        display: grid;
        gap: 13px;
        padding: 22px 2px 0;
      }
      .spotifyConfirmationModal .orderConfirmation .mpFormTitle {
        margin: 0;
        text-align: center;
        font-size: clamp(24px, 4vw, 30px);
        line-height: 1.08;
        font-weight: 900;
        color: #1ed760;
        background: linear-gradient(135deg, #d9ffe6 0%, #1ed760 52%, #00a862 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 24px rgba(30, 215, 96, .24);
      }
      .spotifyConfirmationModal .orderConfirmationDesc {
        max-height: 190px;
        overflow-y: auto;
        padding: 12px 13px;
        border: 1px solid rgba(255, 255, 255, .08);
        border-radius: 16px;
        background: rgba(3, 8, 6, .55);
        color: rgba(241, 255, 246, .82);
        font-size: 13px;
        line-height: 1.52;
        font-weight: 600;
      }
      .spotifyHelpCta {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 13px 14px;
        border-radius: 18px;
        border: 1px solid rgba(30, 215, 96, .46);
        background: linear-gradient(135deg, rgba(30, 215, 96, .16), rgba(47, 128, 255, .11));
        color: #f4fff7;
        text-decoration: none;
        box-shadow: 0 14px 34px rgba(30, 215, 96, .15), inset 0 1px 0 rgba(255, 255, 255, .08);
        transition: transform .18s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
      }
      .spotifyHelpCta:hover {
        transform: translateY(-1px);
        border-color: rgba(30, 215, 96, .74);
        box-shadow: 0 18px 42px rgba(30, 215, 96, .22), 0 0 22px rgba(47, 128, 255, .13), inset 0 1px 0 rgba(255, 255, 255, .12);
      }
      .spotifyHelpCtaIcon {
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: rgba(30, 215, 96, .14);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .spotifyHelpCtaText {
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .spotifyHelpCtaText strong {
        color: #ffffff;
        font-size: 14px;
        line-height: 1.2;
        font-weight: 900;
      }
      .spotifyHelpCtaText small {
        color: rgba(235, 255, 243, .68);
        font-size: 11px;
        line-height: 1.35;
        font-weight: 600;
      }
      .spotifyHelpCtaArrow {
        color: #1ed760;
        font-size: 18px;
        font-weight: 900;
      }
      .spotifyConfirmationModal .orderConfirmationActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 0;
      }
      .spotifyConfirmationModal .mpBtn {
        min-height: 52px;
        border-radius: 16px;
      }

      @media (max-width: 560px) {
        #modal.premiumOrderFormOpen .modalCard { width: min(100% - 20px, 520px); }
        .universalOrderForm.premiumOrderForm { padding-top: 24px; gap: 16px; }
        .premiumOrderForm .orderConfirmationActions { grid-template-columns: 1fr; }
        #modal.hboMaxOrderFormOpen {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.hboMaxOrderFormOpen .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 120px);
          overflow-y: auto;
          padding: 18px 16px 16px;
          border-radius: 22px;
        }
        .hboMaxOrderForm {
          gap: 12px;
          padding: 18px 0 0;
        }
        .hboMaxOrderForm .mpFormTitle {
          max-width: calc(100% - 78px);
          margin: 0 auto;
          font-size: 24px;
        }
        .hboMaxOrderForm .hboMaxOrderHint {
          font-size: 12px;
          line-height: 1.38;
        }
        .hboMaxOrderForm .premiumOrderFields {
          gap: 10px;
        }
        .hboMaxOrderForm .universalField input,
        .hboMaxOrderForm .universalField textarea {
          min-height: 48px;
          border-radius: 14px;
          font-size: 14px;
          padding: 12px 14px;
        }
        .hboMaxOrderForm .orderConfirmationActions {
          grid-template-columns: 1fr;
          gap: 9px;
        }
        .hboMaxOrderForm .mpBtn {
          min-height: 48px;
          font-size: 14px;
        }
        .mpStockBadge { white-space: normal; line-height: 1.25; }
        #modal.spotifyConfirmationModal {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.spotifyConfirmationModal .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 120px);
          padding: 18px 16px 16px;
          border-radius: 22px;
        }
        #modal.spotifyConfirmationModal .close {
          top: 12px;
          right: 12px;
          padding: 8px 11px;
          border-radius: 12px;
          font-size: 12px;
        }
        .spotifyConfirmationModal .orderConfirmation {
          gap: 10px;
          padding: 18px 0 0;
        }
        .spotifyConfirmationModal .orderConfirmation .mpFormTitle {
          max-width: calc(100% - 82px);
          margin: 0 auto;
          font-size: 24px;
        }
        .spotifyConfirmationModal .orderConfirmationDesc {
          max-height: 142px;
          padding: 10px 11px;
          border-radius: 14px;
          font-size: 12px;
          line-height: 1.42;
        }
        .spotifyHelpCta {
          grid-template-columns: auto 1fr auto;
          gap: 9px;
          padding: 11px 12px;
          border-radius: 16px;
        }
        .spotifyHelpCtaIcon {
          width: 32px;
          height: 32px;
          border-radius: 11px;
        }
        .spotifyHelpCtaText strong {
          font-size: 13px;
        }
        .spotifyHelpCtaText small {
          font-size: 10.5px;
        }
        .spotifyConfirmationModal .orderConfirmationActions {
          gap: 9px;
        }
        .spotifyConfirmationModal .mpBtn {
          min-height: 48px;
          font-size: 14px;
        }
        #modal.spotifyConfirmationModal .mBottom {
          margin-top: 9px;
          padding-top: 8px;
        }
        #modal.spotifyConfirmationModal .mSmall {
          font-size: 11px;
        }
        body.spotifyConfirmationActive .gameFab,
        body.spotifyConfirmationActive .waFab {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(14px) scale(.96) !important;
        }
      }

      #modal.orderConfirmationModal {
        align-items: center;
        padding: 20px;
        background: rgba(0, 0, 0, .78);
        backdrop-filter: blur(7px);
      }
      #modal.orderConfirmationModal .modalCard {
        display: flex;
        flex-direction: column;
        width: min(500px, calc(100vw - 32px));
        max-height: min(720px, calc(100dvh - 40px));
        overflow: hidden;
        padding: 0;
        border: 1px solid rgba(255, 255, 255, .11);
        border-radius: 18px;
        background: linear-gradient(180deg, #15171b 0%, #0f1114 100%);
        box-shadow: 0 24px 70px rgba(0, 0, 0, .62);
      }
      #modal.orderConfirmationModal .close {
        top: 12px;
        right: 12px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: rgba(255, 255, 255, .62);
        font-size: 25px;
        font-weight: 400;
        line-height: 1;
      }
      #modal.orderConfirmationModal .close:hover {
        background: rgba(255, 255, 255, .06);
        color: #fff;
      }
      #modal.orderConfirmationModal .mTop,
      #modal.orderConfirmationModal .mPlansTitle,
      #modal.orderConfirmationModal .mPlans,
      #modal.orderConfirmationModal .mInfoBox,
      #modal.orderConfirmationModal #mDesc,
      #modal.orderConfirmationModal .mBottom {
        display: none !important;
      }
      #modal.orderConfirmationModal #mForm {
        margin: 0 !important;
        min-height: 0;
      }
      #modal.orderConfirmationModal .orderConfirmation {
        display: grid;
        gap: 14px;
        margin: 0;
        padding: 18px;
        background: transparent;
      }
      .orderConfirmationHeader {
        display: flex;
        align-items: center;
        min-height: 38px;
        gap: 11px;
        padding-right: 42px;
      }
      .orderConfirmationWarningIcon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        color: #f0c94b;
      }
      .orderConfirmationWarningIcon svg {
        width: 28px;
        height: 28px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }
      #modal.orderConfirmationModal .orderConfirmationTitle {
        margin: 0;
        color: #f7f7f8;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -.01em;
      }
      #modal.orderConfirmationModal .orderConfirmationProduct {
        margin-top: 3px;
        color: rgba(255, 255, 255, .58);
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
      }
      #modal.orderConfirmationModal .orderConfirmationTerms {
        min-height: 0;
        max-height: min(330px, 42dvh);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, .2) transparent;
        padding: 14px 15px;
        border: 1px solid rgba(255, 255, 255, .08);
        border-radius: 12px;
        background: #090b0e;
        color: rgba(244, 244, 245, .82);
      }
      #modal.orderConfirmationModal .orderConfirmationTerms::-webkit-scrollbar {
        width: 6px;
      }
      #modal.orderConfirmationModal .orderConfirmationTerms::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(255, 255, 255, .2);
      }
      #modal.orderConfirmationModal .orderConfirmationDesc,
      #modal.orderConfirmationModal .orderConfirmationNote {
        color: inherit;
        font-size: 13px;
        font-weight: 450;
        line-height: 1.55;
        text-align: left;
      }
      #modal.orderConfirmationModal .orderConfirmationDesc p,
      #modal.orderConfirmationModal .orderConfirmationNote p {
        margin: 0 0 10px;
      }
      #modal.orderConfirmationModal .orderConfirmationDesc p:last-child,
      #modal.orderConfirmationModal .orderConfirmationNote p:last-child {
        margin-bottom: 0;
      }
      #modal.orderConfirmationModal .orderConfirmationDesc strong,
      #modal.orderConfirmationModal .orderConfirmationNote strong {
        color: #fff;
        font-weight: 750;
      }
      #modal.orderConfirmationModal .orderConfirmationNote {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, .07);
      }
      #modal.orderConfirmationModal .orderConfirmationHelpInline {
        margin: 10px 0 0;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, .07);
        font-size: 12.5px;
        line-height: 1.45;
      }
      #modal.orderConfirmationModal .orderConfirmationHelpInline a {
        color: #e8d27a;
        font-weight: 650;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      #modal.orderConfirmationModal .orderConfirmationActions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
        margin: 0;
      }
      #modal.orderConfirmationModal .orderConfirmationActions .mpBtn {
        width: 100%;
        min-height: 46px;
        margin: 0;
        padding: 10px 12px;
        border: 1px solid transparent;
        border-radius: 10px;
        box-shadow: none;
        font-family: inherit;
        font-size: 13px;
        font-weight: 750;
        line-height: 1.25;
        transition: border-color .16s ease, background .16s ease, color .16s ease;
      }
      #modal.orderConfirmationModal .orderConfirmationActions .mpBtn:hover {
        transform: none;
        box-shadow: none;
      }
      #modal.orderConfirmationModal .orderConfirmationCancel {
        border-color: rgba(255, 255, 255, .1);
        background: #202329;
        color: rgba(255, 255, 255, .84);
      }
      #modal.orderConfirmationModal #orderConfirmationConfirm {
        border-color: rgba(240, 201, 75, .42);
        background: #e4bf49;
        color: #17130a;
      }
      #modal.orderConfirmationModal .orderConfirmationCancel:hover {
        background: #292d34;
      }
      #modal.orderConfirmationModal #orderConfirmationConfirm:hover {
        background: #f0cc57;
      }
      #modal.orderConfirmationModal #orderConfirmationConfirm:disabled {
        border-color: rgba(255, 255, 255, .08);
        background: #2a2c31;
        color: rgba(255, 255, 255, .38);
        cursor: not-allowed;
        opacity: .78;
      }
      #modal.orderConfirmationModal .orderConfirmationConsentForm {
        display: grid;
        gap: 9px;
        min-width: 0;
      }
      #modal.orderConfirmationModal .orderConfirmationConsent {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        align-items: start;
        gap: 9px;
        min-width: 0;
        color: rgba(255, 255, 255, .78);
        font-size: 12.5px;
        font-weight: 550;
        line-height: 1.45;
        cursor: pointer;
      }
      #modal.orderConfirmationModal .orderConfirmationConsent input[type="checkbox"] {
        appearance: auto;
        width: 16px;
        min-width: 16px;
        height: 16px;
        min-height: 16px;
        margin: 1px 0 0;
        padding: 0;
        border-radius: 3px;
        accent-color: #e4bf49;
        cursor: pointer;
      }
      #modal.orderConfirmationModal .orderConfirmationConsent input[type="checkbox"]:focus-visible,
      #modal.orderConfirmationModal .orderConfirmationConsent a:focus-visible {
        outline: 2px solid #f0c94b;
        outline-offset: 3px;
      }
      #modal.orderConfirmationModal .orderConfirmationConsent a {
        color: #f0c94b;
        font-weight: 700;
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      #modal.orderConfirmationModal .orderConfirmationConsentError {
        margin: 0;
        color: #ffcf70;
        font-size: 12px;
        font-weight: 650;
        line-height: 1.4;
      }
      body.orderConfirmationActive .gameFab,
      body.orderConfirmationActive .waFab {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      @media (max-width: 560px) {
        #modal.orderConfirmationModal {
          align-items: center;
          padding:
            max(14px, env(safe-area-inset-top))
            14px
            max(14px, env(safe-area-inset-bottom));
        }
        #modal.orderConfirmationModal .modalCard {
          width: min(100%, 500px);
          max-height: calc(100dvh - max(28px, env(safe-area-inset-top) + env(safe-area-inset-bottom)));
          padding: 0;
          border-radius: 16px;
        }
        #modal.orderConfirmationModal .close {
          top: 9px;
          right: 9px;
          width: 32px;
          height: 32px;
          padding: 0;
          border-radius: 8px;
          font-size: 23px;
        }
        #modal.orderConfirmationModal .orderConfirmation {
          gap: 11px;
          padding: 14px;
        }
        .orderConfirmationHeader {
          min-height: 34px;
          gap: 9px;
          padding-right: 36px;
        }
        .orderConfirmationWarningIcon {
          width: 29px;
          height: 29px;
          flex-basis: 29px;
        }
        .orderConfirmationWarningIcon svg {
          width: 25px;
          height: 25px;
        }
        #modal.orderConfirmationModal .orderConfirmationTitle {
          font-size: 18px;
        }
        #modal.orderConfirmationModal .orderConfirmationProduct {
          font-size: 12px;
        }
        #modal.orderConfirmationModal .orderConfirmationTerms {
          max-height: min(310px, 44dvh);
          padding: 12px 13px;
          border-radius: 11px;
        }
        #modal.orderConfirmationModal .orderConfirmationDesc,
        #modal.orderConfirmationModal .orderConfirmationNote {
          font-size: 12.5px;
          line-height: 1.5;
        }
        #modal.orderConfirmationModal .orderConfirmationActions {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
        }
        #modal.orderConfirmationModal .orderConfirmationActions .mpBtn {
          min-height: 44px;
          padding: 9px 8px;
          font-size: 12px;
        }
        #modal.orderConfirmationModal .orderConfirmationConsent {
          grid-template-columns: 17px minmax(0, 1fr);
          gap: 8px;
          font-size: 12px;
        }
        #modal.orderConfirmationModal .orderConfirmationConsent input[type="checkbox"] {
          width: 15px;
          min-width: 15px;
          height: 15px;
          min-height: 15px;
        }
      }
      @media (max-width: 767px) {
        #modal #universalOrderForm input,
        #modal #universalOrderForm textarea,
        #modal #universalOrderForm select { font-size: 16px; }
        #modal #universalOrderForm .orderConfirmationActions { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        #modal.hboMaxOrderFormOpen .modalCard { max-height: calc(100dvh - max(28px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))); }
      }
      @media (max-width: 560px) and (max-height: 650px) {
        #modal.premiumOrderFormOpen .modalCard { padding: 14px 16px; }
        #modal .spotifyCredentialsForm { padding-top: 8px !important; gap: 8px !important; }
        #modal.premiumOrderFormOpen:has(.spotifyCredentialsForm) .modalCard { padding: 10px 16px; }
        #modal .spotifyCredentialsForm { padding-top: 0 !important; gap: 6px !important; }
        #modal .spotifyCredentialsForm .spotifyCredentialsHint { font-size: 11px; line-height: 1.3; }
        #modal .spotifyCredentialsForm .mpFormTitle { font-size: 22px; margin-bottom: 0; }
        #modal .spotifyCredentialsForm .premiumOrderFields { gap: 7px; }
        #modal .spotifyCredentialsForm .universalField,
        #modal .spotifyCredentialsForm .spotifyPasswordField { gap: 4px; }
        #modal .spotifyCredentialsForm input { min-height: 48px; padding-top: 10px; padding-bottom: 10px; }
        #modal .spotifyCredentialsForm .mpBtn { min-height: 48px; }
        #modal.premiumOrderFormOpen .mBottom { margin-top: 8px; padding-top: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  function setSpotifyConfirmationMode(enabled) {
    const modal = document.getElementById("modal");
    modal?.classList.toggle("spotifyConfirmationModal", Boolean(enabled));
    document.body.classList.toggle("spotifyConfirmationActive", Boolean(enabled));
  }

  function setOrderConfirmationMode(enabled) {
    const modal = document.getElementById("modal");
    const closeButton = document.getElementById("closeModal");
    modal?.classList.toggle("orderConfirmationModal", Boolean(enabled));
    document.body.classList.toggle("orderConfirmationActive", Boolean(enabled));
    if (!closeButton) return;
    if (enabled) {
      closeButton.dataset.orderOriginalLabel ||= closeButton.textContent || "Bağla ✕";
      closeButton.textContent = "×";
      closeButton.setAttribute("aria-label", "Bağla");
      closeButton.title = "Bağla";
    } else if (closeButton.dataset.orderOriginalLabel) {
      closeButton.textContent = closeButton.dataset.orderOriginalLabel;
      closeButton.removeAttribute("aria-label");
      closeButton.removeAttribute("title");
      document.querySelector("#modal .modalCard")?.removeAttribute("aria-labelledby");
    }
  }

  function setPremiumFormMode(enabled) {
    document.getElementById("modal")?.classList.toggle("premiumOrderFormOpen", Boolean(enabled));
    if (enabled) {
      setSpotifyConfirmationMode(false);
      setOrderConfirmationMode(false);
    }
  }

  function setNetflixPersonalFormMode(enabled) {
    const modal = document.getElementById("modal");
    const closeButton = document.getElementById("closeModal");
    modal?.classList.toggle("netflixPersonalFormOpen", Boolean(enabled));
    document.body.classList.toggle("netflixPersonalFormActive", Boolean(enabled));
    if (enabled) syncNetflixVisualViewport();
    else {
      document.body.classList.remove("netflixKeyboardOpen");
      modal?.style.removeProperty("--netflix-vv-height");
      modal?.style.removeProperty("--netflix-vv-top");
    }
    if (!closeButton) return;
    if (enabled) {
      closeButton.dataset.netflixOriginalLabel ||= closeButton.textContent || "Bağla ✕";
      closeButton.textContent = "×";
      closeButton.setAttribute("aria-label", "Bağla");
      closeButton.title = "Bağla";
    } else if (closeButton.dataset.netflixOriginalLabel) {
      closeButton.textContent = closeButton.dataset.netflixOriginalLabel;
      closeButton.removeAttribute("aria-label");
      closeButton.removeAttribute("title");
      delete closeButton.dataset.netflixOriginalLabel;
      document.querySelector("#modal .modalCard")?.removeAttribute("aria-labelledby");
    }
  }

  function syncNetflixVisualViewport() {
    const modal = document.getElementById("modal");
    const viewport = window.visualViewport;
    if (!modal?.classList.contains("netflixPersonalFormOpen") || window.innerWidth > 390) return;
    const visibleHeight = viewport?.height || window.innerHeight;
    const keyboardOpen = Boolean(viewport && window.innerHeight - visibleHeight > 120);
    modal.style.setProperty("--netflix-vv-height", `${Math.round(visibleHeight)}px`);
    modal.style.setProperty("--netflix-vv-top", `${Math.round(viewport?.offsetTop || 0)}px`);
    document.body.classList.toggle("netflixKeyboardOpen", keyboardOpen);
  }

  window.visualViewport?.addEventListener("resize", syncNetflixVisualViewport);
  window.visualViewport?.addEventListener("scroll", syncNetflixVisualViewport);

  function setHboFormMode(enabled) {
    document.getElementById("modal")?.classList.toggle("hboMaxOrderFormOpen", Boolean(enabled));
    if (enabled) setOrderConfirmationMode(false);
  }

  injectOrderStyles();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function cleanConfirmationLabel(value) {
    return String(value || "")
      .replace(/[*_`#]+/g, "")
      .replace(/[👉👈🔐↗]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function confirmationTitle(value) {
    const title = cleanConfirmationLabel(value);
    return !title || /^Sifarişi təsdiqləyin!?$/i.test(title) ? "Diqqət!" : title;
  }

  function confirmationButtonText(value) {
    const label = cleanConfirmationLabel(value);
    return /^(Təsdiqləyirəm|Təsdiq edirəm|Davam et|Sifarişi təsdiqlə)$/i.test(label)
      ? "Oxudum və təsdiqləyirəm"
      : (label || DEFAULT_CONFIRMATION.confirmText);
  }

  function formatConfirmationText(value) {
    const normalized = String(value || "")
      .replace(/\r/g, "")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/`+/g, "")
      .trim();
    if (!normalized) return "";

    return escapeHtml(normalized)
      .split(/\n{2,}/)
      .map((paragraph) => paragraph
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
        .replace(/\*\*|__/g, "")
        .replace(/^([^:<]{2,70}:)(\s|$)/, "<strong>$1</strong>$2")
        .replace(/\n/g, "<br>"))
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join("");
  }

  function agreementText() {
    const configured = typeof CMS_CONTENT !== "undefined"
      ? CMS_CONTENT?.orderSettings?.agreementText
      : "";
    return cleanConfirmationLabel(configured) || DEFAULT_AGREEMENT_TEXT;
  }

  function agreementMarkup(value) {
    const text = cleanConfirmationLabel(value) || DEFAULT_AGREEMENT_TEXT;
    const phraseIndex = text.indexOf(AGREEMENT_LINK_TEXT);
    const link = `<a href="/sertler">${escapeHtml(AGREEMENT_LINK_TEXT)}</a>`;
    if (phraseIndex < 0) return `<a href="/sertler">${escapeHtml(text)}</a>`;
    return `${escapeHtml(text.slice(0, phraseIndex))}${link}${escapeHtml(text.slice(phraseIndex + AGREEMENT_LINK_TEXT.length))}`;
  }

  function resetOrderConsent() {
    orderTermsAccepted = false;
    const checkbox = document.getElementById("orderTermsAgreement");
    const confirmButton = document.getElementById("orderConfirmationConfirm");
    const error = document.getElementById("orderConfirmationConsentError");
    if (checkbox) {
      checkbox.checked = false;
      checkbox.setCustomValidity("");
    }
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.setAttribute("aria-disabled", "true");
    }
    if (error) error.hidden = true;
  }

  function showAgreementError() {
    const checkbox = document.getElementById("orderTermsAgreement");
    const error = document.getElementById("orderConfirmationConsentError");
    orderTermsAccepted = false;
    if (error) error.hidden = false;
    if (checkbox) {
      checkbox.setCustomValidity(AGREEMENT_ERROR);
      checkbox.focus();
    }
    toastMessage(AGREEMENT_ERROR);
  }

  function activeFields(product) {
    if (product?.id === "netflix") return [];
    // Only catalog-owned configuration may select a customer-information form.
    if (!DATA.products.some((item) => item.id === product?.id)) return [];
    const fields = Array.isArray(product.formFields) ? product.formFields : [];
    const active = fields.filter((field) => field.enabled !== false);
    if (fields.length) return active;
    const legacyByProduct = { spotify: "spotify", hbomax: "name_code_4", prime: "name_code_5", canva: "email", google_ai: "email" };
    return LEGACY_FLOW_FIELDS[legacyByProduct[product.id]] || [];
  }

  function isSpotifyProduct(product) {
    return product?.id === "spotify";
  }

  function isHboProduct(product) {
    return product?.id === "hbomax";
  }

  function isNetflixPersonalProduct(product) {
    return product?.id === "netflix";
  }

  function codeLengthForField(field) {
    const key = String(field?.key || "").toLowerCase();
    const label = String(field?.label || "").toLowerCase();
    if (key === "code_4" || key === "room_code" || key === "pin" || label.includes("4 rəqəm")) return 4;
    if (key === "code_5" || label.includes("5 rəqəm")) return 5;
    return 0;
  }

  function toastMessage(text, type = "bad") {
    const container = document.querySelector(".toasts") || document.getElementById("toasts");
    if (container) {
      const item = document.createElement("div");
      item.className = `toast ${type}`;
      item.textContent = text;
      container.appendChild(item);
      setTimeout(() => item.remove(), 3200);
      return;
    }
    alert(text);
  }

  function confirmationFor(product) {
    const source = product.confirmationModal || product.orderConfirmation || {};
    return {
      ...DEFAULT_CONFIRMATION,
      ...source,
      helpLink: { ...DEFAULT_CONFIRMATION.helpLink, ...(source.helpLink || {}) }
    };
  }

  function flowFor(product) {
    const fields = activeFields(product);
    return fields.length ? "form_confirm_whatsapp" : "confirm_then_whatsapp";
  }

  function stockNumber(product) {
    return window.MirpanelInventory?.productState(product).available ?? null;
  }

  function stockIsAvailable(product, plan) {
    if(window.MirpanelInventory){const state=window.MirpanelInventory.productState(product);return plan?window.MirpanelInventory.planState(product,product.plans.indexOf(plan))?.canOrder===true:state.canOrder;}
    if (product.active === false || product.soldOut === true || product.flow === "out_of_stock") return false;
    if (!(product?.plans || []).some((plan) => Number(plan.price) > 0)) return false;
    if(product.stockEnabled===true)return false;
    return true;
  }

  function stockBadge(product) {
    const stock = stockNumber(product);
    if (!stockIsAvailable(product)) {
      return { text: "Stokda yoxdur", className: "out" };
    }
    if (stock !== null && stock <= 5) {
      return { text: `Az qalıb • ${stock} ədəd`, className: "low" };
    }
    if (stock !== null) {
      return { text: `Stokda var • ${stock} ədəd`, className: "ok" };
    }
    return null;
  }

  function planLabel(plan) {
    if (!plan) return "";
    return String(plan.label || (Number(plan.months) > 0 ? `${plan.months} aylıq` : "")).trim();
  }

  function selectedPlan(product) {
    return product?.plans?.[currentPlanIdx] || product?.plans?.[0];
  }

  function priceText(product, plan) {
    return `${Number(plan?.price || 0).toFixed(2)} ${product.currency || "₼"}`;
  }

  function createOrderId() {
    return Math.floor(10000 + Math.random() * 90000);
  }

  function submitGoogleSheets(order) {
    if (!GOOGLE_SCRIPT_URL) return;

    const formData = new FormData();
    formData.append("orderId", order.orderId);
    formData.append("product", order.productTitle);
    formData.append("plan", order.planText);
    formData.append("price", order.price);
    formData.append("extra", order.extraText);
    formData.append("message", order.message);
    formData.append("createdAt", new Date().toISOString());
    if (order.stockBefore !== undefined) formData.append("stockBefore", order.stockBefore ?? "");
    if (order.stockAfter !== undefined) formData.append("stockAfter", order.stockAfter ?? "");

    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    }).catch((error) => {
      console.error("Sheet Error:", error);
    });
  }

  function setFooter(text) {
    const footer = document.querySelector("#modal .mSmall");
    if (footer) footer.textContent = text || "";
  }

  function openBaseModal(product, plan) {
    modalSession += 1;
    renderModalContent("");
    document.querySelector("#modal .modalCard")?.removeAttribute("aria-labelledby");
    document.getElementById("modal")?.classList.remove("paymentFlowOpen");
    resetOrderConsent();
    setPremiumFormMode(false);
    setOrderConfirmationMode(false);
    setSpotifyConfirmationMode(false);
    setHboFormMode(false);
    setNetflixPersonalFormMode(false);
    document.getElementById("modal")?.classList.add("show");
    lockBodyScroll();

    const img = document.getElementById("mImg");
    const title = document.getElementById("mTitle");
    const desc = document.getElementById("mDesc");
    const info = document.getElementById("mInfo");
    const infoBox = document.getElementById("mInfoBox");
    const plans = document.getElementById("mPlans");
    const selectedPlanLabel = planLabel(plan);

    if (img) img.src = product.image || "";
    if (title) title.textContent = publicProductTitle(product.title);
    if (desc) desc.textContent = product.desc || "";
    if (info) info.textContent = selectedPlanLabel ? `${selectedPlanLabel} / ${priceText(product, plan)}` : priceText(product, plan);
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";
    setFooter("");
  }

  function clearSpotifyCredentials() {
    // Clear even detached Spotify input references before replacing the modal.
    document.querySelectorAll('#mForm .spotifyCredentialsForm input').forEach(input => {
      input.value = '';
      input.defaultValue = '';
      if (input.autocomplete === 'current-password') input.type = 'password';
    });
  }

  function renderModalContent(html) {
    const form = document.getElementById("mForm");
    clearSpotifyCredentials();
    if (form) form.innerHTML = html;
  }

  function closeOrderModal() {
    if (directPaying || window.MirpanelPaymentFlow?.isSubmitting?.()) return;
    modalSession += 1;
    renderModalContent("");
    document.querySelector("#modal .modalCard")?.removeAttribute("aria-labelledby");
    resetOrderConsent();
    setPremiumFormMode(false);
    setSpotifyConfirmationMode(false);
    setOrderConfirmationMode(false);
    setHboFormMode(false);
    setNetflixPersonalFormMode(false);
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    document.getElementById("modal")?.classList.remove("show");
    document.body.classList.remove("noScroll");
  }

  function buildWhatsAppMessage(product, plan, formData = {}, orderId = createOrderId()) {
    const settings = { extraMessage: "", includeSeller: true, includeStock: false, ...(product.whatsapp || {}) };
    const lines = ["Salam, sifariş etmək istəyirəm.", "", `Sifariş №: ${orderId}`, `Məhsul: ${publicProductTitle(product.title) || product.id}`];
    const selectedPlanLabel = planLabel(plan);

    if (selectedPlanLabel) lines.push(`Plan: ${selectedPlanLabel}`);
    lines.push(`Qiymət: ${priceText(product, plan)}`);
    lines.push("İstifadə qaydaları və şərtlər qəbul edildi: Bəli");
    if (settings.includeSeller && product.seller) lines.push(`Satıcı: ${product.seller}`);
    const stock = stockNumber(product);
    if (settings.includeStock && stock !== null) lines.push(`Stok: ${stock}`);

    const formLines = Object.entries(formData)
      .filter(([, value]) => String(value || "").trim())
      .map(([label, value]) => `${label}: ${value}`);

    if (formLines.length) lines.push("", ...formLines);
    if (settings.extraMessage) lines.push("", settings.extraMessage);

    return {
      orderId,
      message: lines.join("\n"),
      planText: selectedPlanLabel || (plan?.months ? `${plan.months} aylıq` : ""),
      price: priceText(product, plan),
      extraText: formLines.join("\n")
    };
  }

  async function decrementStock() {
    // Reservation/final delivery already belong to the server ledger. Never update a second CMS counter.
    return {skipped:true};
  }

  function buildWhatsAppUrl(message) {
    const configured = typeof PHONE_WA === "string" ? PHONE_WA.trim() : "";
    let phone = "";
    try {
      const parsed = new URL(configured, window.location.origin);
      phone = parsed.hostname === "wa.me" ? parsed.pathname : configured;
    } catch {
      phone = configured;
    }
    phone = String(phone).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = `994${phone.slice(1)}`;
    if (!/^\d{8,15}$/.test(phone)) phone = "994515243545";

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const verified = new URL(whatsappUrl);
    if (verified.protocol !== "https:" || verified.hostname !== "wa.me" || !/^\/\d{8,15}$/.test(verified.pathname)) {
      throw new Error("WhatsApp keçidi yaradıla bilmədi.");
    }
    return verified.href;
  }

  function showSubmittedOrder(orderCode, statusMessage) {
    setFooter("");
    renderModalContent(`
      <section class="paymentWhatsAppFallback" aria-labelledby="paymentWhatsAppFallbackTitle" aria-live="polite">
        <h2 id="paymentWhatsAppFallbackTitle">Sifariş qəbul edildi</h2>
        <p>Sifariş nömrəsi: <strong>${escapeHtml(orderCode || "")}</strong></p>
        <p id="paymentCustomerOrderStatus">${escapeHtml(statusMessage||'Sifarişiniz yoxlanılır.')}</p>
        <a data-native-navigation href="/profil?tab=orders&amp;order=${encodeURIComponent(orderCode || '')}">Sifarişlərimə bax</a>
        <a data-native-navigation href="/mehsul">Məhsullara bax</a>
        <a data-native-navigation href="/">Ana səhifə</a>
      </section>
    `);
    // Read only the existing checkout capability. Never submit or send a message.
    const statusNode=document.getElementById('paymentCustomerOrderStatus');
    let statusTimer;
    const updateStatus=async()=>{if(!statusNode.isConnected)return;try{if(!document.hidden){const order=await window.MirpanelPaymentFlow?.recoverSubmitted();if(order?.orderCode===orderCode&&order.statusMessage)statusNode.textContent=order.statusMessage;}}catch{/* Keep last confirmed status on network failure. */}if(statusNode.isConnected)statusTimer=setTimeout(updateStatus,15000);};
    statusTimer=setTimeout(updateStatus,15000);window.addEventListener('pagehide',()=>clearTimeout(statusTimer),{once:true});
  }

  window.mirpanelBuildWhatsAppUrl = buildWhatsAppUrl;

  async function openWhatsApp(product, plan, formData = {}, paymentOrder = null) {
    if (!orderTermsAccepted) {
      showAgreementError();
      return;
    }
    if (!stockIsAvailable(product, plan)) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    if (!paymentOrder) {
      if (!window.MirpanelPaymentFlow?.start) {
        alert("Ödəniş sistemi hazırda əlçatan deyil. Bir qədər sonra yenidən cəhd edin.");
        return;
      }
      const draft = buildWhatsAppMessage(product, plan, formData, "PENDING");
      paymentOrder = await window.MirpanelPaymentFlow.start({
        product,
        plan,
        planIndex: Math.max(0, product?.plans?.indexOf(plan) ?? 0),
        whatsappExtraText: draft.extraText
      });
      if (!paymentOrder) return;
    }

    showSubmittedOrder(paymentOrder.orderCode, paymentOrder.statusMessage);
    if (!paymentOrder.idempotent) {
      // Optional stock/Sheets synchronization must not hold a paid checkout open.
      const order = buildWhatsAppMessage(product, plan, formData, paymentOrder.orderCode);
      void decrementStock(product).catch(() => ({ skipped: true })).then((stockResult) => {
        submitGoogleSheets({ ...order, productTitle: publicProductTitle(product.title) || product.id,
          stockBefore: stockResult?.stockBefore, stockAfter: stockResult?.stockAfter });
      });
    }
  }

  function showForm(product, plan, onDone, forCart=false) {
    const session = modalSession;
    const fields = activeFields(product);
    const isSpotify = isSpotifyProduct(product);
    if (!fields.length && !isSpotify) {
      onDone({});
      return;
    }

    const isHbo = isHboProduct(product);
    const isNetflixPersonal = isNetflixPersonalProduct(product);
    setOrderConfirmationMode(false);
    setPremiumFormMode(!isHbo && !isNetflixPersonal);
    setHboFormMode(isHbo);
    setNetflixPersonalFormMode(isNetflixPersonal);
    const closeButton = document.getElementById("closeModal");
    if (closeButton) {
      closeButton.textContent = "×";
      closeButton.setAttribute("aria-label", "Bağla");
      closeButton.title = "Bağla";
    }
    setFooter("");
    const formClass = isHbo
      ? "mpForm universalOrderForm hboMaxOrderForm"
      : "mpForm universalOrderForm premiumOrderForm";
    const title = product.formTitle || (isHbo ? "HBO Max profil məlumatları" : "Sifariş məlumatları");
    const formDescription = product.formDescription || (isHbo ? "HBO Max profil adını və 4 rəqəmli profil kodunu daxil edin." : "");
    const hint = formDescription ? `<p class="hboMaxOrderHint">${escapeHtml(formDescription)}</p>` : "";

    if (isNetflixPersonal) {
      const nameField = fields.find((field) => field.key === "name") || fields[0];
      const pinField = fields.find((field) => field.key === "code_4") || fields.find((field) => codeLengthForField(field) === 4);
      const initialPin = String(pinField?.defaultValue || "").replace(/\D/g, "").slice(0, 4);
      renderModalContent(`
        <form class="mpForm universalOrderForm netflixPersonalForm" id="universalOrderForm" data-product-id="${escapeHtml(product.id || "")}" novalidate>
          <header class="netflixPersonalHeader">
            <div class="netflixPersonalTopline">
              <img class="netflixPersonalLogo" src="/assets/netflix.png" alt="" aria-hidden="true">
              <span class="netflixPersonalEyebrow">NETFLIX · ŞƏXSİ PROFİL</span>
              <span class="netflixPersonalPrice" aria-label="Seçilmiş planın qiyməti">${escapeHtml(priceText(product, plan))}</span>
            </div>
            <h2 class="netflixPersonalTitle" id="netflixPersonalTitle">Netflix profilinizi yaradın</h2>
            <p class="netflixPersonalIntro"><strong>Bu, sayt qeydiyyatı deyil.</strong> Netflix profiliniz üçün ad və 4 rəqəmli PIN seçin.</p>
          </header>
          <div class="netflixPersonalFields">
            <label class="netflixPersonalField" for="netflixProfileName">
              <span class="netflixPersonalFieldLabel">Profil adı</span>
              <input id="netflixProfileName" type="text" name="${escapeHtml(nameField?.key || "name")}" data-label="${escapeHtml(nameField?.label || "Ad")}" placeholder="Məsələn: Aysel" autocomplete="name" value="${escapeHtml(nameField?.defaultValue || "")}" ${nameField?.required === false ? "" : "required"}>
              <small class="netflixPersonalHelp">Profilinizdə görünəcək.</small>
            </label>
            <fieldset class="netflixPersonalField" aria-describedby="netflixPinHelp">
              <legend class="netflixPersonalFieldLabel">4 rəqəmli profil PIN-i</legend>
              <input class="netflixPinSource" id="netflixPinValue" type="text" name="${escapeHtml(pinField?.key || "code_4")}" data-label="${escapeHtml(pinField?.label || "Otaq kodu")}" data-code-length="4" inputmode="numeric" maxlength="4" pattern="\d{4}" value="${escapeHtml(initialPin)}" ${pinField?.required === false ? "" : "required"} tabindex="-1" aria-hidden="true">
              <div class="netflixPinBoxes" role="group" aria-label="4 rəqəmli profil PIN-i">
                ${[0, 1, 2, 3].map((index) => `<input class="netflixPinDigit" data-pin-digit="${index}" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" aria-label="PIN ${index + 1}-ci rəqəm" value="${escapeHtml(initialPin[index] || "")}">`).join("")}
              </div>
              <small class="netflixPersonalHelp" id="netflixPinHelp">PIN-i yadda saxlayın.</small>
            </fieldset>
          </div>
          <div class="netflixPersonalActions">
            <button class="mpBtn orderConfirmationCancel" id="universalFormCancel" type="button">Ləğv et</button>
            <button class="mpBtn netflixContinueBtn" id="netflixContinueButton" type="submit" disabled aria-disabled="true">Davam et →</button>
          </div>
        </form>
      `);
      document.querySelector("#modal .modalCard")?.setAttribute("aria-labelledby", "netflixPersonalTitle");
    } else if (isSpotify) {
      const configuredResetUrl = String(product?.spotifyPasswordResetUrl || "").trim();
      let resetUrl = DEFAULT_SPOTIFY_RESET_URL;
      try {
        const candidate = new URL(configuredResetUrl || DEFAULT_SPOTIFY_RESET_URL);
        if (candidate.protocol === "https:") resetUrl = candidate.href;
      } catch {}
      renderModalContent(`
        <form class="mpForm universalOrderForm premiumOrderForm spotifyCredentialsForm" id="universalOrderForm" data-product-id="${escapeHtml(product.id || "")}" novalidate>
          <div class="mpFormTitle">Spotify hesab məlumatları</div>
          <div class="premiumOrderFields">
            <label class="universalField premiumUniversalField" for="spotifyEmail"><span>Gmail ünvanınız</span><input id="spotifyEmail" type="email" name="email" data-label="Gmail ünvanınız" placeholder="Gmail ünvanınızı yazın" autocomplete="username" autocapitalize="none" spellcheck="false" inputmode="email" required></label>
            <label class="spotifyPasswordField" for="spotifyPassword"><span>Spotify şifrəniz</span><span class="spotifyPasswordControl"><input id="spotifyPassword" type="password" name="spotifyCurrentPassword" data-label="Spotify şifrəniz" placeholder="Spotify şifrənizi yazın" autocomplete="current-password" autocapitalize="none" spellcheck="false" required><button class="spotifyPasswordToggle" type="button" data-password-toggle="spotifyPassword" aria-label="Şifrəni göstər" title="Şifrəni göstər"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg></button></span></label>
            <p class="spotifyPasswordReset">Şifrənizi unutmusunuz? <a href="${escapeHtml(resetUrl)}" target="_blank" rel="noopener noreferrer">Şifrənizi sıfırlayın.</a></p>
          </div>
          <div class="orderConfirmationActions premiumOrderActions">
            <button class="mpBtn orderConfirmationCancel" id="universalFormCancel" type="button">Ləğv et</button>
            <button class="mpBtn premiumContinueBtn" id="spotifyContinueButton" type="submit" disabled aria-disabled="true">Davam et</button>
          </div>
        </form>
      `);
    } else renderModalContent(`
      <form class="${formClass}" id="universalOrderForm" data-product-id="${escapeHtml(product.id || "")}">
        <div class="mpFormTitle">${escapeHtml(title)}</div>
        <p class="orderFormProduct">${escapeHtml(publicProductTitle(product.title))}</p>
        ${hint}
        <div class="premiumOrderFields">
          ${fields.map((field) => {
            const inputType = field.type || "text";
            const codeLength = codeLengthForField(field);
            const label = field.label || field.key;
            const placeholder = field.placeholder || "";
            const common = `
              name="${escapeHtml(field.key)}"
              data-label="${escapeHtml(label)}"
              ${codeLength ? `data-code-length="${codeLength}"` : ""}
              placeholder="${escapeHtml(placeholder)}"
              autocomplete="${inputType === "password" ? "current-password" : "off"}"
              ${field.minLength ? `minlength="${Number(field.minLength)}"` : ""}
              ${field.maxLength ? `maxlength="${Number(field.maxLength)}"` : ""}
              ${Number.isFinite(Number(field.min)) ? `min="${Number(field.min)}"` : ""}
              ${Number.isFinite(Number(field.max)) ? `max="${Number(field.max)}"` : ""}
              ${Number.isFinite(Number(field.step)) ? `step="${Number(field.step)}"` : ""}
              ${field.defaultValue !== undefined ? `value="${escapeHtml(field.defaultValue)}"` : ""}
              ${field.readOnly === true ? "readonly" : ""}
              ${codeLength ? `inputmode="numeric" maxlength="${codeLength}" pattern="\\d{${codeLength}}"` : ""}
              ${field.required ? "required" : ""}
            `;

            if (inputType === "textarea") {
              return `<label class="universalField premiumUniversalField"><span>${escapeHtml(label)}</span><textarea ${common}></textarea></label>`;
            }

            if (inputType === "select") {
              const options = Array.isArray(field.options) ? field.options : [];
              return `<label class="universalField premiumUniversalField"><span>${escapeHtml(label)}</span><select ${common}><option value="">${escapeHtml(placeholder || "Seçin")}</option>${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
            }

            return `<label class="universalField premiumUniversalField"><span>${escapeHtml(label)}</span><input type="${codeLength ? "text" : escapeHtml(inputType)}" ${common}></label>`;
          }).join("")}
        </div>
        <div class="orderConfirmationActions premiumOrderActions">
          <button class="mpBtn orderConfirmationCancel" id="universalFormCancel" type="button">Ləğv et</button>
          <button class="mpBtn premiumContinueBtn" type="submit">Davam et</button>
        </div>
      </form>
    `);

    document.getElementById("universalFormCancel").onclick = closeOrderModal;
    if (isNetflixPersonal) {
      const form = document.getElementById("universalOrderForm");
      const nameInput = document.getElementById("netflixProfileName");
      const sourceInput = document.getElementById("netflixPinValue");
      const digits = [...form.querySelectorAll("[data-pin-digit]")];
      const continueButton = document.getElementById("netflixContinueButton");
      const syncPin = () => {
        sourceInput.value = digits.map((input) => input.value.replace(/\D/g, "").slice(0, 1)).join("");
        const ready = Boolean(nameInput.value.trim()) && /^\d{4}$/.test(sourceInput.value) && (!forCart||form.querySelector('[data-cart-consent]')?.checked===true);
        continueButton.disabled = !ready;
        continueButton.setAttribute("aria-disabled", String(!ready));
      };
      const distributePin = (value, start = 0) => {
        const numbers = String(value || "").replace(/\D/g, "").slice(0, 4 - start);
        [...numbers].forEach((number, offset) => { digits[start + offset].value = number; });
        syncPin();
        digits[Math.min(start + numbers.length, 3)]?.focus();
      };
      nameInput.addEventListener("input", syncPin);
      digits.forEach((input, index) => {
        input.addEventListener("input", () => {
          const numbers = input.value.replace(/\D/g, "");
          input.value = numbers.slice(-1);
          syncPin();
          if (input.value && index < digits.length - 1) digits[index + 1].focus();
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Backspace" && !input.value && index > 0) {
            event.preventDefault(); digits[index - 1].value = ""; digits[index - 1].focus(); syncPin();
          }
          if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); digits[index - 1].focus(); }
          if (event.key === "ArrowRight" && index < digits.length - 1) { event.preventDefault(); digits[index + 1].focus(); }
        });
        input.addEventListener("paste", (event) => {
          event.preventDefault(); distributePin(event.clipboardData?.getData("text") || "", index);
        });
      });
      syncPin();
      requestAnimationFrame(() => nameInput.focus());
    } else if (isSpotify) {
      const form = document.getElementById("universalOrderForm");
      const email = document.getElementById("spotifyEmail");
      const password = document.getElementById("spotifyPassword");
      const continueButton = document.getElementById("spotifyContinueButton");
      const syncSpotifyValidity = () => {
        const ready = email.validity.valid && Boolean(email.value.trim()) && Boolean(password.value);
        continueButton.disabled = !ready;
        continueButton.setAttribute("aria-disabled", String(!ready));
      };
      email.addEventListener("input", syncSpotifyValidity);
      password.addEventListener("input", syncSpotifyValidity);
      form.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
          const input = document.getElementById(button.dataset.passwordToggle);
          const reveal = input.type === "password";
          input.type = reveal ? "text" : "password";
          const label = reveal ? "Şifrəni gizlət" : "Şifrəni göstər";
          button.setAttribute("aria-label", label);
          button.title = label;
          input.focus({ preventScroll: true });
        });
      });
      syncSpotifyValidity();
    }
    document.querySelectorAll("#universalOrderForm [data-code-length]").forEach((input) => {
      input.addEventListener("input", () => {
        const codeLength = Number(input.dataset.codeLength) || 0;
        input.value = input.value.replace(/\D/g, "").slice(0, codeLength);
      });
    });
    document.getElementById("universalOrderForm").onsubmit = (event) => {
      event.preventDefault();
      if (session !== modalSession) return;
      if(forCart&&!event.currentTarget.querySelector('[data-cart-consent]')?.checked)return;
      if (isSpotify) {
        const email = document.getElementById("spotifyEmail");
        const password = document.getElementById("spotifyPassword");
        if (!email.checkValidity()) { email.reportValidity(); email.focus(); return; }
        if (!password.value) { password.focus(); return; }
        const credentials = { "Gmail ünvanınız": email.value.trim(), "Spotify şifrəniz": password.value };
        clearSpotifyCredentials();
        onDone(credentials);
        return;
      }
      const values = {};
      const controls = event.currentTarget.querySelectorAll("input:not([data-pin-digit]):not([data-cart-consent]), textarea, select");

      for (const control of controls) {
        const value = control.value.trim();
        if (control.required && !value) {
          control.focus();
          return;
        }
        const codeLength = Number(control.dataset.codeLength) || 0;
        if (codeLength && !new RegExp(`^\\d{${codeLength}}$`).test(value)) {
          control.focus();
          toastMessage(`Sadəcə ${codeLength} rəqəm yazmalısınız`);
          return;
        }
        if (control.dataset.privateConfirmation !== "true") values[control.dataset.label || control.name] = value;
      }

      onDone(values);
    };
    if(forCart){
      const button=document.querySelector('#universalOrderForm button[type=submit]');
      button.textContent='Şərtləri oxudum və təsdiqlədim';
      const terms=document.createElement('section');terms.className='cart-form-terms';
      terms.innerHTML=`<h3>Diqqət!</h3>${formatConfirmationText(forCart.terms)||'<p>Bu məhsul üçün ümumi sifariş şərtləri tətbiq olunur.</p>'}${formatConfirmationText(forCart.note)}<label><input type="checkbox" data-cart-consent> ${agreementMarkup(DEFAULT_AGREEMENT_TEXT)}</label>`;
      button.parentElement.before(terms);
      button.disabled=true;terms.querySelector('input').onchange=e=>{if(isNetflixPersonal)document.getElementById('netflixProfileName').dispatchEvent(new Event('input'));else button.disabled=!e.target.checked;};
    }
  }

  function showConfirmation(product, plan, formData, onConfirm, cartQuote) {
    const session = modalSession;
    resetOrderConsent();
    setPremiumFormMode(false);
    const settings = confirmationFor(product);
    const isSpotify = isSpotifyProduct(product);
    const helpUrl = String(settings.helpLink?.url || "").trim();
    const defaultSpotifyHelpLabel = "Şifrənizi bilmirsiniz? Buradan sıfırlayın";
    const storedHelpLabel = cleanConfirmationLabel(settings.helpLink?.label);
    const helpLabel = isSpotify && (!storedHelpLabel || /Toxunun|unutmusunuzsa/i.test(storedHelpLabel))
      ? defaultSpotifyHelpLabel
      : storedHelpLabel;
    const showHelp = !isSpotify && settings.helpLink?.enabled === true && helpUrl.startsWith("https://") && helpLabel;
    const title = cartQuote?'Diqqət!':confirmationTitle(settings.title);
    const confirmText = cartQuote?'Şərtləri oxudum və təsdiqlədim':confirmationButtonText(settings.confirmText);
    const cancelText = cleanConfirmationLabel(settings.cancelText) || DEFAULT_CONFIRMATION.cancelText;
    const descriptionHtml = formatConfirmationText(cartQuote?cartQuote.terms:settings.description);
    const noteHtml = formatConfirmationText(cartQuote?cartQuote.note:product.note);

    setSpotifyConfirmationMode(isSpotify);
    setOrderConfirmationMode(true);
    setFooter("");
    renderModalContent(`
      <div class="mpForm orderConfirmation${isSpotify ? " spotifyOrderConfirmation" : ""}">
        <div class="orderConfirmationHeader">
          <span class="orderConfirmationWarningIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z"></path>
              <path d="M12 9v4.5"></path>
              <path d="M12 17h.01"></path>
            </svg>
          </span>
          <div>
            <h2 class="orderConfirmationTitle" id="orderConfirmationTitle">${escapeHtml(title)}</h2>
            ${cartQuote?'':`<div class="orderConfirmationProduct">${escapeHtml(publicProductTitle(product.title) || product.id || "")}</div>`}
          </div>
        </div>
        <div class="orderConfirmationTerms" tabindex="0" aria-label="${escapeHtml(publicProductTitle(product.title))} sifariş şərtləri">
          <div class="orderConfirmationDesc">${descriptionHtml || "<p>Bu məhsul üçün sifariş şərtlərini oxuyub təsdiqləyin.</p>"}</div>
          ${noteHtml ? `<div class="orderConfirmationNote">${noteHtml}</div>` : ""}
          ${showHelp ? `<p class="orderConfirmationHelpInline"><a href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(helpLabel)}</a></p>` : ""}
        </div>
        <form id="orderConfirmationConsentForm" class="orderConfirmationConsentForm" novalidate>
          <label class="orderConfirmationConsent" for="orderTermsAgreement">
            <input id="orderTermsAgreement" name="orderTermsAgreement" type="checkbox" required aria-describedby="orderConfirmationConsentError">
            <span>${agreementMarkup(cartQuote?DEFAULT_AGREEMENT_TEXT:agreementText())}</span>
          </label>
          <p id="orderConfirmationConsentError" class="orderConfirmationConsentError" role="alert" hidden>${escapeHtml(AGREEMENT_ERROR)}</p>
          <div class="orderConfirmationActions">
            <button id="orderConfirmationCancel" class="mpBtn orderConfirmationCancel" type="button">${escapeHtml(cancelText)}</button>
            <button id="orderConfirmationConfirm" class="mpBtn" type="submit" disabled aria-disabled="true">${escapeHtml(confirmText)}</button>
          </div>
        </form>
      </div>
    `);

    document.querySelector("#modal .modalCard")?.setAttribute("aria-labelledby", "orderConfirmationTitle");
    document.getElementById("orderConfirmationCancel").onclick = closeOrderModal;
    const consentForm = document.getElementById("orderConfirmationConsentForm");
    const consentCheckbox = document.getElementById("orderTermsAgreement");
    const confirmButton = document.getElementById("orderConfirmationConfirm");
    const consentError = document.getElementById("orderConfirmationConsentError");

    consentCheckbox.addEventListener("change", () => {
      orderTermsAccepted = consentCheckbox.checked;
      consentCheckbox.setCustomValidity("");
      confirmButton.disabled = !consentCheckbox.checked;
      confirmButton.setAttribute("aria-disabled", String(!consentCheckbox.checked));
      consentError.hidden = true;
    });

    consentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (session !== modalSession) return;
      if (!consentCheckbox.checked) {
        showAgreementError();
        return;
      }
      consentCheckbox.setCustomValidity("");
      orderTermsAccepted = true;
      onConfirm(formData);
    });
  }

  const directReturnKey='mirpanel.direct.return.v1',directPaymentKey='mirpanel.direct.wallet.v1';
  const directMoney=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
  const directIcon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  async function directApi(path,body){
    const r=await fetch('/api/payments/shop/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(d.error||'Ödəniş xidməti hazırda əlçatan deyil.'),{status:r.status});return d;
  }
  function directChoices(product,plan,cardFlow,session){
    const planIndex=product.plans.indexOf(plan),items=[{productId:product.id,planIndex,quantity:1}];
    const identity=JSON.stringify(items);
    function pendingPayment(){try{const p=JSON.parse(sessionStorage.getItem(directPaymentKey)||'null');return p?.identity===identity?p:null;}catch{return null;}}
    function clearPending(){try{sessionStorage.removeItem(directPaymentKey);}catch{}}
    setOrderConfirmationMode(false);setSpotifyConfirmationMode(false);
    const check=directIcon('<path d="m6 12 4 4 8-8"/>');
    const cardIcon=directIcon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>');
    const walletIcon=directIcon('<path d="M20 9V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2M3 8h15"/><rect x="13" y="9" width="9" height="7" rx="2"/><path d="M16 12.5h.01"/>');
    const lock=directIcon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>');
    renderModalContent(`<section class="direct-pay-options direct-pay-chooser">
      <h2 id="directPaymentTitle">Ödəniş</h2><p class="direct-pay-product">${escapeHtml(publicProductTitle(product.title))} · ${escapeHtml(planLabel(plan))}</p>
      <fieldset><legend>Üsul seçin</legend>
        <label class="direct-pay-method"><input type="radio" name="directPaymentMethod" value="card" checked>${cardIcon}<span>Kartdan karta</span><span class="direct-pay-check">${check}</span></label>
        <label class="direct-pay-method"><input type="radio" name="directPaymentMethod" value="wallet">${walletIcon}<span>Balansdan<small data-direct-balance hidden></small></span><span class="direct-pay-check">${check}</span></label>
      </fieldset>
      <div class="direct-pay-shortage" hidden><p data-direct-short role="status"></p><button type="button" data-direct-topup>Balansı artır</button></div>
      <p data-direct-error role="alert"></p>
      <div class="direct-pay-total"><span>Yekun məbləğ</span><strong data-direct-total aria-live="polite">—</strong></div>
      <button class="direct-pay-primary" type="button" data-direct-submit><span data-direct-lock hidden>${lock}</span><span data-direct-label>Ödənişi tamamla</span></button>
      <button class="direct-pay-retry" type="button" hidden>Əvvəlki ödənişi yenidən yoxla</button>
    </section>`);
    const root=document.querySelector('#mForm .direct-pay-options');if(!root)return;
    const modal=document.querySelector('#modal .modalCard');modal?.setAttribute('aria-labelledby','directPaymentTitle');
    const find=s=>root.querySelector(s),form=find('fieldset'),balance=find('[data-direct-balance]'),shortage=find('.direct-pay-shortage'),short=find('[data-direct-short]'),topup=find('[data-direct-topup]'),error=find('[data-direct-error]'),total=find('[data-direct-total]'),pay=find('[data-direct-submit]'),retry=find('.direct-pay-retry'),lockIcon=find('[data-direct-lock]'),label=find('[data-direct-label]');
    let data=null,mode='card',busy=false,quoteError='';
    function update(){
      const wallet=mode==='wallet',signed=Number.isSafeInteger(data?.balanceCents),missing=signed?data.totalCents-data.balanceCents:0;
      total.textContent=data?directMoney(data.totalCents):'—';
      balance.hidden=!wallet;
      balance.textContent=signed?'Cari balans: '+directMoney(data.balanceCents):data?'Balansdan ödəmək üçün daxil olun.':quoteError||'Balans yoxlanılır…';
      shortage.hidden=!wallet||missing<=0;
      if(missing>0)short.textContent='Balans kifayət etmir — '+directMoney(missing)+' çatmır.';
      form.disabled=busy;pay.disabled=busy||wallet&&(!signed||missing>0||!!pendingPayment());
      lockIcon.hidden=!pay.disabled||busy;
      label.textContent=busy?'Gözləyin…':'Ödənişi tamamla';
      retry.hidden=!wallet||!signed||!pendingPayment();retry.disabled=busy;
      topup.disabled=busy;
    }
    form.onchange=e=>{mode=e.target.value;update();};
    topup.onclick=()=>{
      const path=location.pathname;try{sessionStorage.setItem(directReturnKey,JSON.stringify({path,productId:product.id,planIndex}));}catch{}
      const next=/^\/mehsul\/[a-z0-9-]+\/?$/.test(path)?path:path==='/mehsul'?'/mehsul':'/';
      location.assign('/balans?returnTo='+encodeURIComponent(next));
    };
    async function quote(){
      try{const d=await directApi('quote',{items});if(!Number.isSafeInteger(d.totalCents))throw Error();data=d;quoteError='';}
      catch{data=null;quoteError='Balans və qiymət məlumatı yüklənmədi.';}
      if(root.isConnected&&session===modalSession)update();
    }
    async function submitWallet(recover=false){
        if(busy||session!==modalSession||!root.isConnected||(recover?retry.hidden:pay.disabled))return;
          const pending=recover?pendingPayment():{identity,requestId:crypto.randomUUID(),total:data.totalCents};if(!pending)return;
        try{sessionStorage.setItem(directPaymentKey,JSON.stringify(pending));}catch{}
        busy=directPaying=true;error.textContent='';update();
        try{const order=await directApi('checkout',{items:items.map((x,i)=>({...x,termsVersion:data.items?.[i]?.termsVersion})),mode:'wallet',requestId:pending.requestId,consentAccepted:true,expectedTotalCents:pending.total});if(!order.paymentConfirmed)throw Error('Ödəniş təsdiqlənmədi.');
          clearPending();
          window.refreshCommunityNav?.();if(!root.isConnected||session!==modalSession)return;
          const url=order.orderCode?'/profil?tab=orders&amp;order='+encodeURIComponent(order.orderCode):'/profil?tab=orders';
          renderModalContent('<section class="direct-pay-options direct-pay-chooser"><h2 id="directPaymentTitle">Ödəniş təsdiqləndi</h2><p>Balansdan ödəniş edildi. Məhsulun hazırlanması gözlənilir.</p><a href="'+url+'">Sifarişlərimə bax</a> · <a href="/mehsul">Məhsullara bax</a> · <a href="/">Ana səhifə</a></section>');
          if(order.orderCreated===true&&order.orderCode)void import('/checkout-sounds.js?v=1').then(m=>m.playCheckoutSound('order',order.orderCode)).catch(()=>{});
        }catch(e){error.textContent=e.status?e.message:'Cavab alınmadı. Eyni ödənişi yenidən yoxlayın.';if([400,401,403,409].includes(e.status)){clearPending();await quote();}}
        finally{busy=directPaying=false;update();}
    }
    pay.onclick=()=>{if(session!==modalSession||busy||pay.disabled)return;if(mode==='card'){modal?.removeAttribute('aria-labelledby');cardFlow();}else void submitWallet();};
    retry.onclick=()=>void submitWallet(true);
    update();find('input:checked')?.focus({preventScroll:true});void quote();
  }
  let directPaying=false;
  function restoreDirectSelection(){
    try{const draft=JSON.parse(sessionStorage.getItem(directReturnKey)||'null');if(!draft||draft.path!==location.pathname)return;
      const p=DATA.products.find(x=>x.id===draft.productId);if(!p?.plans?.[draft.planIndex])return;
      if(!currentProduct||currentProduct.id!==p.id)window.openProductPage?.(p.id);
      const row=document.querySelectorAll('#pp-plans-container .pp-plan-label')[draft.planIndex];if(!row)return;row.click();sessionStorage.removeItem(directReturnKey);
    }catch{}
  }
  window.addEventListener('pageshow',()=>setTimeout(restoreDirectSelection,100));
  window.addEventListener('mirpanel:route-ready',restoreDirectSelection);

  function runOrderFlow(product, plan, loginOnGuest=true) {
    const catalogProduct = DATA.products.find((item) => item.id === product?.id);
    if (catalogProduct) {
      if (!(catalogProduct.plans || []).includes(plan)) {
        toastMessage("Seçilmiş paket bu məhsula aid deyil. Paketi yenidən seçin.");
        return;
      }
      product = catalogProduct;
    }
    if(plan&&Number(plan.price)>0){
      openPreparedCartEntry(product,plan,loginOnGuest);return;
    }
    if (!stockIsAvailable(product, plan) || !plan || Number(plan.price) <= 0) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    if(!isSpotifyProduct(product)&&!activeFields(product).some(f=>f.type==='password')){
      if(!window.MirpanelCart?.open){void import('/cart-store.js?v=cart-ready-now-1').then(()=>{if(window.MirpanelCart?.open)runOrderFlow(product,plan);else toastMessage('Səbət hazırda açılmır.');}).catch(()=>toastMessage('Səbət hazırda açılmır.'));return;}
      const index=product.plans.indexOf(plan);
      openBaseModal(product,plan);const session=modalSession;
      const add=(values,quote)=>{
        try{window.MirpanelCart.add(product.id,index,values,quote.termsVersion);}
        catch(e){toastMessage(e.message);return;}
        closeOrderModal();
        window.MirpanelCart.open();
      };
      const hasFields=activeFields(product).length>0;
      const request=()=>directApi('quote',{items:[{productId:product.id,planIndex:index,quantity:1}]}).then(d=>d.items?.[0]).catch(()=>null);
      let pending=request(),submitting=false;
      const show=display=>{
        const confirm=async values=>{
          if(submitting)return;submitting=true;
          const button=document.querySelector('#mForm button[type=submit]');if(button)button.disabled=true;
          const quote=await pending;submitting=false;if(session!==modalSession)return;
          if(!quote?.termsVersion){toastMessage('Şərtlər təsdiqlənmədi. Yenidən cəhd edin.');pending=request();if(button)button.disabled=false;return;}
          if(quote.terms!==display.terms||quote.note!==display.note){toastMessage('Şərtlər yenilənib. Yenidən oxuyub təsdiqləyin.');show(quote);return;}
          if(button)button.disabled=false;add(values,quote);
        };
        if(hasFields)showForm(product,plan,confirm,display);
        else showConfirmation(product,plan,{},confirm,display);
      };
      show({terms:String(plan.terms||confirmationFor(product).description||''),note:String(product.note||'')});
      return;
    }

    openBaseModal(product, plan);
    const session = modalSession;
    const flow = flowFor(product);
    const needsForm = flow === "form_then_whatsapp" || flow === "form_confirm_whatsapp";
    const needsConfirmation = true;

    const continueToFormOrWhatsApp = () => {
      if (session !== modalSession) return;
      if (needsForm) {
        showForm(product, plan, (nextFormData) => {
          if (session === modalSession) openWhatsApp(product, plan, nextFormData);
        });
        return;
      }
      openWhatsApp(product, plan, {});
    };

    if (needsConfirmation) {
      showConfirmation(product, plan, {}, () => directChoices(product,plan,continueToFormOrWhatsApp,session));
      return;
    }

    continueToFormOrWhatsApp();
  }

  function requireOrderConsent(product, plan, onAccepted) {
    if (!stockIsAvailable(product, plan) || !plan || Number(plan.price) <= 0) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }
    openBaseModal(product, plan);
    showConfirmation(product, plan, {}, () => {
      if (typeof onAccepted === "function") onAccepted();
    });
  }

  function decorateProductPage(product) {
    if (!product) return;

    const badge = document.querySelector(".pp-avail-badge");
    const button = document.getElementById("pp-order-btn");
    const delivery = document.querySelector(".pp-delivery");
    const available = stockIsAvailable(product);

    if (badge) {
      badge.textContent = available ? "Mövcuddur" : "Stokda yoxdur";
      badge.classList.toggle("out", !available);
    }

    // The HBO button must not become clickable between local plan rendering
    // and the stock controller's authoritative readiness check.
    if (button && !isHboProduct(product)) {
      button.disabled = !available;
      button.textContent = available ? (document.body.classList.contains("product-page-document") ? "İndi al" : "Sifariş et") : "Stokda yoxdur";
      button.classList.toggle("disabled", !available);
    }

    if (delivery) {
      document
        .querySelectorAll("#productPageView .pp-detail-stock-line, #productPageView .detailStockBadge")
        .forEach((element) => element.remove());
      delivery
        .querySelectorAll(".mpSellerLine, .mpStockLine")
        .forEach((element) => element.remove());

      if (product.seller) {
        const seller = document.createElement("div");
        seller.className = "mpSellerLine";
        seller.textContent = `Satıcı: ${product.seller}`;
        delivery.appendChild(seller);
      }

      const badgeData = stockBadge(product);
      if (badgeData) {
        const stock = document.createElement("div");
        stock.className = "mpStockLine";
        stock.innerHTML = `<span class="mpStockBadge ${badgeData.className}">${escapeHtml(badgeData.text)}</span>`;
        delivery.appendChild(stock);
      }
    }
  }

  function wrapProductPage() {
    if (typeof openProductPage !== "function") return;
    const original = openProductPage;

    openProductPage = function patchedOpenProductPage(id) {
      original(id);
      prefetchSelectedTerms();
      setTimeout(() => {
        if(typeof currentProduct==='undefined'||currentProduct?.id!==id)return;
        const product = DATA.products.find((item) => item.id === id);
        decorateProductPage(product);
      }, 0);
    };
  }

  function patchLegacyNameCodeForm() {
    if (typeof window.showNameCodeForm !== "function" || window.showNameCodeForm.__mirpanelHboMaxPatched) return;
    const original = window.showNameCodeForm;

    window.showNameCodeForm = function patchedNameCodeForm(product, plan, digits) {
      if (isHboProduct(product)) {
        runOrderFlow(product, plan);
        return;
      }
      return original.call(this, product, plan, digits);
    };

    window.showNameCodeForm.__mirpanelHboMaxPatched = true;
  }

  function patchLegacySendWhatsApp() {
    if (typeof window.sendWA !== "function" || window.sendWA.__mirpanelConsentPatched) return;
    window.sendWA = function receiptProtectedSendWA(product, plan) {
      // Legacy controls must enter the same server-verified receipt checkout,
      // never the old direct WhatsApp popup / client-only order-number path.
      return runOrderFlow(product, plan);
    };

    window.sendWA.__mirpanelConsentPatched = true;
  }

  let homeCartOpening=false;
  async function openHomeCart(button) {
    if(homeCartOpening||cartOpening?.open||document.querySelector('dialog.homeCardPlanPicker[open],dialog.cart-entry[open]'))return;
    const product=DATA.products.find(item=>item.id===button.closest('[data-product-id]')?.dataset.productId);
    if(!product)return;
    homeCartOpening=true;
    try{
      const inventory=window.MirpanelInventory;
      if(!inventory||!await inventory.refresh())throw Error('Stok məlumatı alınmadı. Yenidən cəhd edin.');
      if(!button.isConnected||!button.closest('.home-page #grid'))return;
      const state=inventory.productState(product);
      const choices=(product.plans||[]).map((plan,index)=>({plan,available:state.plans[index]?.canOrder}))
        .filter(({plan})=>plan.active!==false&&Number(plan.price)>0);
      if(!choices.some(item=>item.available))throw Error('Stokda yoxdur.');
      if(choices.length===1){runOrderFlow(product,choices[0].plan,false);return;}
      const dialog=document.createElement('dialog'),heading=document.createElement('h2'),close=document.createElement('button');
      dialog.className='homeCardPlanPicker';dialog.setAttribute('aria-labelledby','homeCardPlanPickerTitle');
      heading.id='homeCardPlanPickerTitle';heading.textContent='Paket seçin';
      close.type='button';close.textContent='Bağla';close.onclick=()=>dialog.close();
      dialog.append(heading);
      for(const {plan,available} of choices){
        const choice=document.createElement('button'),name=document.createElement('span'),price=document.createElement('strong');
        choice.type='button';choice.disabled=!available;
        name.textContent=plan.label?.trim()||plan.name||(plan.durationDays?plan.durationDays+' gün':plan.months?plan.months+' ay':'Paket');
        price.textContent=available?Number(plan.price).toFixed(2)+' '+(product.currency||'₼'):'Stokda yoxdur';
        choice.append(name,price);
        choice.onclick=()=>{dialog.close();runOrderFlow(product,plan,false);};
        dialog.append(choice);
      }
      dialog.append(close);
      const life=new AbortController();
      window.addEventListener('mirpanel:route-leave',()=>dialog.close(),{signal:life.signal});
      dialog.addEventListener('close',()=>{life.abort();dialog.remove();},{once:true});
      document.body.append(dialog);dialog.showModal();
    }catch(error){toastMessage(error.message);}
    finally{homeCartOpening=false;}
  }

  document.addEventListener(
    "click",
    (event) => {
      const add=event.target.closest('.home-page #grid .homeCardAdd');
      if(add){
        event.preventDefault();event.stopImmediatePropagation();
        if(!add.disabled)void openHomeCart(add);
        return;
      }
      const button = event.target.closest("#pp-order-btn, #cartAddProduct");
      if (!button || !currentProduct) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runOrderFlow(currentProduct, selectedPlan(currentProduct),button.id!=='cartAddProduct');
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("modal");
    if (event.key === "Escape" && modal?.classList.contains("show")) {
      closeOrderModal();
      return;
    }
    if (event.key !== "Tab" || !modal?.classList.contains("show") || !modal.classList.contains("netflixPersonalFormOpen")) return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("modal");
    if (event.target === modal) closeOrderModal();
  });
  document.getElementById("closeModal")?.addEventListener("click", closeOrderModal);
  const spotifyModal = document.getElementById('modal');
  if (spotifyModal) new MutationObserver(() => {
    // Legacy Escape/back handlers can hide the modal without replacing its DOM.
    const shown=spotifyModal.classList.contains('show');
    spotifyModal.setAttribute('aria-hidden',String(!shown));
    if (!shown) clearSpotifyCredentials();
  }).observe(spotifyModal, {attributes:true,attributeFilter:['class']});

  wrapProductPage();
  prefetchSelectedTerms();
  window.addEventListener("pageshow", prefetchSelectedTerms);
  window.addEventListener("mirpanel:route-ready", prefetchSelectedTerms);
  document.addEventListener("click", event => {
    if (event.target.closest("#pp-plans-container .pp-plan-label")) setTimeout(prefetchSelectedTerms, 0);
  }, true);
  patchLegacyNameCodeForm();
  patchLegacySendWhatsApp();
  window.mirpanelRequireOrderConsent = requireOrderConsent;
  // Reload/back recovery only shows the already-created order; it never creates
  // a reservation or automatically navigates away again.
  void Promise.resolve(window.MirpanelPaymentFlow?.recoverSubmitted?.()).then((order) => {
    const modal = document.getElementById("modal");
    if (!order || !modal || modal.classList.contains("show")) return;
    modal.classList.add("show", "paymentFlowOpen");
    document.body.classList.add("noScroll");
    showSubmittedOrder(order.orderCode, order.statusMessage);
  }).catch(() => {});
})();
