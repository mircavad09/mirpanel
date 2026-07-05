(() => {
  const DEFAULT_CONFIRMATION = {
    enabled: false,
    title: "Sifarişi təsdiqləyin",
    description: "",
    confirmText: "Təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
    helpLink: { enabled: false, label: "", url: "" }
  };

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
      { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ünvanınızı yazın", required: true, enabled: true },
      { key: "password", type: "password", label: "Şifrə", placeholder: "Şifrənizi yazın", required: true, enabled: true }
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

      .universalOrderForm.premiumOrderForm { display: grid; gap: 18px; padding: 28px 2px 0; }
      .premiumOrderForm .mpFormTitle {
        margin: 0 0 8px; text-align: center; font-size: clamp(24px, 4vw, 30px); font-weight: 900; line-height: 1.15; letter-spacing: 0;
        color: #2dff86; background: linear-gradient(135deg, #c9ffe1 0%, #2dff86 45%, #13b87c 100%);
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 24px rgba(45, 255, 134, .22);
      }
      .premiumOrderForm .premiumOrderFields { display: grid; gap: 14px; }
      .premiumOrderForm .universalField { display: grid; gap: 8px; margin: 0; }
      .premiumOrderForm .universalField span { color: rgba(235, 255, 243, .9); font-size: 13px; font-weight: 800; }
      .premiumOrderForm .universalField input,
      .premiumOrderForm .universalField textarea {
        width: 100%; min-height: 52px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, .28); background: rgba(3, 8, 7, .74);
        color: #f7fff9; font-family: inherit; font-size: 15px; font-weight: 600; outline: none; padding: 14px 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 12px 30px rgba(0, 0, 0, .22);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, transform .18s ease;
      }
      .premiumOrderForm .universalField textarea { min-height: 112px; resize: vertical; }
      .premiumOrderForm .universalField input::placeholder,
      .premiumOrderForm .universalField textarea::placeholder { color: rgba(226, 232, 240, .48); font-weight: 500; }
      .premiumOrderForm .universalField input:focus,
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

      #modal.hboOrderFormOpen .modalCard {
        width: min(540px, calc(100vw - 28px));
        border: 1px solid rgba(122, 92, 255, .74);
        background:
          radial-gradient(circle at 22% 0%, rgba(122, 92, 255, .24), transparent 42%),
          radial-gradient(circle at 88% 14%, rgba(34, 211, 238, .15), transparent 36%),
          linear-gradient(180deg, rgba(11, 13, 26, .98), rgba(5, 7, 15, .99));
        box-shadow: 0 26px 80px rgba(0, 0, 0, .66), 0 0 38px rgba(122, 92, 255, .20), 0 0 28px rgba(34, 211, 238, .10);
      }

      #modal.hboOrderFormOpen .mTop,
      #modal.hboOrderFormOpen .mPlansTitle,
      #modal.hboOrderFormOpen .mPlans,
      #modal.hboOrderFormOpen .mInfoBox,
      #modal.hboOrderFormOpen #mDesc { display: none !important; }
      #modal.hboOrderFormOpen #mForm { margin-top: 0 !important; }
      #modal.hboOrderFormOpen .mBottom { margin-top: 14px; padding-top: 11px; border-top: 1px solid rgba(122, 92, 255, .20); }
      #modal.hboOrderFormOpen #mInfo { color: rgba(245, 248, 255, .94); font-size: 16px; font-weight: 900; text-align: center; }
      #modal.hboOrderFormOpen .mSmall { display: none; }

      .hboOrderForm {
        display: grid;
        gap: 16px;
        padding: 25px 2px 0;
      }
      .hboOrderForm .mpFormTitle {
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
      .hboOrderForm .hboOrderHint {
        margin: -5px 0 2px;
        color: rgba(226, 232, 255, .72);
        font-size: 13px;
        line-height: 1.45;
        font-weight: 650;
        text-align: center;
      }
      .hboOrderForm .premiumOrderFields {
        display: grid;
        gap: 13px;
      }
      .hboOrderForm .universalField {
        display: grid;
        gap: 8px;
        margin: 0;
      }
      .hboOrderForm .universalField span {
        color: rgba(235, 240, 255, .9);
        font-size: 13px;
        font-weight: 850;
      }
      .hboOrderForm .universalField input,
      .hboOrderForm .universalField textarea {
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
      .hboOrderForm .universalField input::placeholder,
      .hboOrderForm .universalField textarea::placeholder {
        color: rgba(226, 232, 240, .48);
      }
      .hboOrderForm .universalField input:focus,
      .hboOrderForm .universalField textarea:focus {
        border-color: rgba(34, 211, 238, .78);
        background: rgba(5, 11, 26, .92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(34, 211, 238, .10), 0 0 30px rgba(122, 92, 255, .18);
      }
      .hboOrderForm .orderConfirmationActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 4px;
      }
      .hboOrderForm .mpBtn {
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
      .hboOrderForm .mpBtn:not(.orderConfirmationCancel) {
        background: linear-gradient(135deg, #7c3aed, #2563eb 55%, #06b6d4);
        box-shadow: 0 15px 36px rgba(37, 99, 235, .27), 0 0 24px rgba(34, 211, 238, .14), inset 0 1px 0 rgba(255, 255, 255, .18);
      }
      .hboOrderForm .orderConfirmationCancel {
        background: linear-gradient(135deg, rgba(55, 65, 81, .96), rgba(24, 31, 48, .96));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .hboOrderForm .mpBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .hboOrderForm .mpBtn:active { transform: translateY(1px) scale(.99); }

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
        #modal.hboOrderFormOpen {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.hboOrderFormOpen .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 120px);
          overflow-y: auto;
          padding: 18px 16px 16px;
          border-radius: 22px;
        }
        .hboOrderForm {
          gap: 12px;
          padding: 18px 0 0;
        }
        .hboOrderForm .mpFormTitle {
          max-width: calc(100% - 78px);
          margin: 0 auto;
          font-size: 24px;
        }
        .hboOrderForm .hboOrderHint {
          font-size: 12px;
          line-height: 1.38;
        }
        .hboOrderForm .premiumOrderFields {
          gap: 10px;
        }
        .hboOrderForm .universalField input,
        .hboOrderForm .universalField textarea {
          min-height: 48px;
          border-radius: 14px;
          font-size: 14px;
          padding: 12px 14px;
        }
        .hboOrderForm .orderConfirmationActions {
          grid-template-columns: 1fr;
          gap: 9px;
        }
        .hboOrderForm .mpBtn {
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
    `;
    document.head.appendChild(style);
  }

  function setSpotifyConfirmationMode(enabled) {
    const modal = document.getElementById("modal");
    modal?.classList.toggle("spotifyConfirmationModal", Boolean(enabled));
    document.body.classList.toggle("spotifyConfirmationActive", Boolean(enabled));
  }

  function setPremiumFormMode(enabled) {
    document.getElementById("modal")?.classList.toggle("premiumOrderFormOpen", Boolean(enabled));
    if (enabled) setSpotifyConfirmationMode(false);
  }

  function setHboFormMode(enabled) {
    document.getElementById("modal")?.classList.toggle("hboOrderFormOpen", Boolean(enabled));
  }

  injectOrderStyles();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function activeFields(product) {
    const fields = Array.isArray(product.formFields) ? product.formFields : [];
    const active = fields.filter((field) => field.enabled !== false);
    if (active.length) return active;
    return LEGACY_FLOW_FIELDS[product?.flow] || [];
  }

  function productToken(product) {
    return [
      product?.id,
      product?.title,
      product?.variant,
      product?.badge,
      product?.category
    ].join(" ").toLowerCase();
  }

  function isHboProduct(product) {
    const token = productToken(product);
    return token.includes("hbomax") || token.includes("hbo max") || token.includes("hbo");
  }

  function isFourDigitCodeField(field) {
    const key = String(field?.key || "").toLowerCase();
    const label = String(field?.label || "").toLowerCase();
    return key === "code_4" || key === "room_code" || key === "pin" || label.includes("4 rəqəm");
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
    const confirmation = confirmationFor(product);
    const source = String(product.orderFlow || "").trim();

    if (ORDER_FLOWS.has(source)) {
      if (confirmation.enabled && source === "direct_whatsapp") return "confirm_then_whatsapp";
      return source;
    }

    if (confirmation.enabled && fields.length) return "form_confirm_whatsapp";
    if (confirmation.enabled) return "confirm_then_whatsapp";
    if (fields.length) return "form_then_whatsapp";
    return "direct_whatsapp";
  }

  function stockNumber(product) {
    if (product?.stockEnabled === false) return null;
    const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
    if (rawStock === null || rawStock === "" || rawStock === undefined) return null;
    const stock = Number(rawStock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }

  function stockIsAvailable(product) {
    if (product.active === false || product.soldOut === true || product.flow === "out_of_stock") return false;
    const stock = stockNumber(product);
    if (stock !== null) return stock > 0;
    return true;
  }

  function stockBadge(product) {
    const stock = stockNumber(product);
    if (product.active === false || product.soldOut === true || product.flow === "out_of_stock" || stock === 0) {
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
    return String(plan.label || "").trim();
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
    setPremiumFormMode(false);
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
    if (title) title.textContent = product.title || "";
    if (desc) desc.textContent = product.desc || "";
    if (info) info.textContent = selectedPlanLabel ? `${selectedPlanLabel} / ${priceText(product, plan)}` : priceText(product, plan);
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";
    setFooter("");
  }

  function renderModalContent(html) {
    const form = document.getElementById("mForm");
    if (form) form.innerHTML = html;
  }

  function closeOrderModal() {
    setPremiumFormMode(false);
    setSpotifyConfirmationMode(false);
    setHboFormMode(false);
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    document.getElementById("modal")?.classList.remove("show");
    document.body.classList.remove("noScroll");
  }

  function buildWhatsAppMessage(product, plan, formData = {}, orderId = createOrderId()) {
    const settings = { extraMessage: "", includeSeller: true, includeStock: false, ...(product.whatsapp || {}) };
    const lines = ["Salam, sifariş etmək istəyirəm.", "", `Sifariş №: ${orderId}`, `Məhsul: ${product.title || product.id}`];
    const selectedPlanLabel = planLabel(plan);

    if (selectedPlanLabel) lines.push(`Plan: ${selectedPlanLabel}`);
    lines.push(`Qiymət: ${priceText(product, plan)}`);
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

  async function decrementStock(product) {
    if (stockNumber(product) === null) return { skipped: true };

    const response = await fetch(STOCK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload.error || payload.code || "");
      const stockSyncUnavailable =
        response.status === 404 ||
        response.status === 503 ||
        message === "STOCK_SYNC_NOT_CONFIGURED" ||
        message.includes("MIRPANEL_GITHUB_TOKEN");

      if (stockSyncUnavailable) {
        console.warn("Mirpanel stock sync is not available yet.", {
          status: response.status,
          code: payload.code || payload.error || ""
        });
        return { skipped: true, unavailable: true };
      }

      if (message === "OUT_OF_STOCK") {
        throw new Error("Stokda yoxdur.");
      }

      throw new Error(payload.error || "Stok yenilənmədi.");
    }

    if (typeof payload.stockAfter === "number") {
      product.stock = payload.stockAfter;
      product.soldOut = payload.stockAfter <= 0;
      decorateProductPage(product);
    }

    return payload;
  }

  async function openWhatsApp(product, plan, formData = {}) {
    if (!stockIsAvailable(product)) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    let stockResult;
    try {
      stockResult = await decrementStock(product);
    } catch (error) {
      decorateProductPage(product);
      alert(error.message || "Stokda yoxdur.");
      return;
    }

    const order = buildWhatsAppMessage(product, plan, formData);
    submitGoogleSheets({
      ...order,
      productTitle: product.title || product.id,
      stockBefore: stockResult?.stockBefore,
      stockAfter: stockResult?.stockAfter
    });

    const separator = PHONE_WA.includes("?") ? "&" : "?";
    const url = `${PHONE_WA}${separator}text=${encodeURIComponent(order.message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    closeOrderModal();
  }

  function showForm(product, plan, onDone) {
    const fields = activeFields(product);
    if (!fields.length) {
      onDone({});
      return;
    }

    const isHbo = isHboProduct(product);
    setPremiumFormMode(!isHbo);
    setHboFormMode(isHbo);
    setFooter("");
    const formClass = isHbo
      ? "mpForm universalOrderForm hboOrderForm"
      : "mpForm universalOrderForm premiumOrderForm";
    const title = isHbo ? "HBO Max profil məlumatları" : "Sifariş məlumatları";
    const hint = isHbo
      ? `<p class="hboOrderHint">Profil adınızı və izləmə kodunu qeyd edin.</p>`
      : "";

    renderModalContent(`
      <form class="${formClass}" id="universalOrderForm">
        <div class="mpFormTitle">${escapeHtml(title)}</div>
        ${hint}
        <div class="premiumOrderFields">
          ${fields.map((field) => {
            const inputType = field.type || "text";
            const fourDigitCode = isHbo && isFourDigitCodeField(field);
            const label = fourDigitCode ? "Profil kodu / PIN" : (field.label || field.key);
            const placeholder = fourDigitCode ? "4 rəqəmli kod yazın" : (field.placeholder || "");
            const common = `
              name="${escapeHtml(field.key)}"
              data-label="${escapeHtml(label)}"
              ${fourDigitCode ? "data-code-length=\"4\"" : ""}
              placeholder="${escapeHtml(placeholder)}"
              autocomplete="${inputType === "password" ? "current-password" : "off"}"
              ${fourDigitCode ? "inputmode=\"numeric\" maxlength=\"4\" pattern=\"\\d{4}\"" : ""}
              ${field.required ? "required" : ""}
            `;

            if (inputType === "textarea") {
              return `<label class="universalField premiumUniversalField"><span>${escapeHtml(label)}</span><textarea ${common}></textarea></label>`;
            }

            return `<label class="universalField premiumUniversalField"><span>${escapeHtml(label)}</span><input type="${fourDigitCode ? "text" : escapeHtml(inputType)}" ${common}></label>`;
          }).join("")}
        </div>
        <div class="orderConfirmationActions premiumOrderActions">
          <button class="mpBtn orderConfirmationCancel" id="universalFormCancel" type="button">Ləğv et</button>
          <button class="mpBtn premiumContinueBtn" type="submit">Davam et</button>
        </div>
      </form>
    `);

    document.getElementById("universalFormCancel").onclick = closeOrderModal;
    document.querySelectorAll("#universalOrderForm [data-code-length='4']").forEach((input) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 4);
      });
    });
    document.getElementById("universalOrderForm").onsubmit = (event) => {
      event.preventDefault();
      const values = {};
      const controls = event.currentTarget.querySelectorAll("input, textarea");

      for (const control of controls) {
        const value = control.value.trim();
        if (control.required && !value) {
          control.focus();
          return;
        }
        if (control.dataset.codeLength === "4" && !/^\d{4}$/.test(value)) {
          control.focus();
          toastMessage("Sadəcə 4 rəqəm yazmalısınız");
          return;
        }
        values[control.dataset.label || control.name] = value;
      }

      onDone(values);
    };
  }

  function showConfirmation(product, plan, formData, onConfirm) {
    setPremiumFormMode(false);
    const settings = confirmationFor(product);
    const isSpotify = String(product?.id || "").toLowerCase().includes("spotify") || String(product?.title || "").toLowerCase().includes("spotify");
    const helpUrl = String(settings.helpLink?.url || "").trim();
    const defaultSpotifyHelpLabel = "Şifrənizi bilmirsiniz? Buradan sıfırlayın";
    const helpLabel = isSpotify
      ? defaultSpotifyHelpLabel
      : String(settings.helpLink?.label || "").trim();
    const showHelp = settings.helpLink?.enabled === true && helpUrl.startsWith("https://") && helpLabel;

    setSpotifyConfirmationMode(isSpotify);

    setFooter(settings.footerText);
    renderModalContent(`
      <div class="mpForm orderConfirmation${isSpotify ? " spotifyOrderConfirmation" : ""}">
        <div class="mpFormTitle">${escapeHtml(settings.title)}</div>
        <div class="orderConfirmationDesc">${escapeHtml(settings.description || "")}</div>
        ${product.note ? `<div class="orderConfirmationNote">${escapeHtml(product.note)}</div>` : ""}
        ${showHelp && isSpotify ? `
          <a class="orderConfirmationHelp spotifyHelpCta" href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">
            <span class="spotifyHelpCtaIcon" aria-hidden="true">🔐</span>
            <span class="spotifyHelpCtaText">
              <strong>${escapeHtml(helpLabel)}</strong>
              <small>Spotify hesab şifrənizi unutmusunuzsa, sifarişdən əvvəl sıfırlayın.</small>
            </span>
            <span class="spotifyHelpCtaArrow" aria-hidden="true">↗</span>
          </a>
        ` : showHelp ? `<a class="orderConfirmationHelp" href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(helpLabel)}</a>` : ""}
        <div class="orderConfirmationActions">
          <button id="orderConfirmationCancel" class="mpBtn orderConfirmationCancel" type="button">${escapeHtml(settings.cancelText)}</button>
          <button id="orderConfirmationConfirm" class="mpBtn" type="button">${escapeHtml(settings.confirmText)}</button>
        </div>
      </div>
    `);

    document.getElementById("orderConfirmationCancel").onclick = closeOrderModal;
    document.getElementById("orderConfirmationConfirm").onclick = () => onConfirm(formData);
  }

  function runOrderFlow(product, plan) {
    if (!stockIsAvailable(product) || !plan || Number(plan.price) <= 0) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    openBaseModal(product, plan);
    const flow = flowFor(product);
    const confirmation = confirmationFor(product);
    const needsForm = flow === "form_then_whatsapp" || flow === "form_confirm_whatsapp";
    const needsConfirmation = confirmation.enabled === true || flow === "confirm_then_whatsapp" || flow === "form_confirm_whatsapp";

    const continueToFormOrWhatsApp = () => {
      if (needsForm) {
        showForm(product, plan, (nextFormData) => openWhatsApp(product, plan, nextFormData));
        return;
      }
      openWhatsApp(product, plan, {});
    };

    if (needsConfirmation) {
      showConfirmation(product, plan, {}, continueToFormOrWhatsApp);
      return;
    }

    continueToFormOrWhatsApp();
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

    if (button) {
      button.disabled = !available;
      button.textContent = available ? "Sifariş et" : "Stokda yoxdur";
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
      setTimeout(() => {
        const product = DATA.products.find((item) => item.id === id);
        decorateProductPage(product);
      }, 0);
    };
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#pp-order-btn");
      if (!button || !currentProduct) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runOrderFlow(currentProduct, selectedPlan(currentProduct));
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("modal")?.classList.contains("show")) closeOrderModal();
  });

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("modal");
    if (event.target === modal) closeOrderModal();
  });

  wrapProductPage();
})();
