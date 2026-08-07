import crypto from "node:crypto";
import { safeText } from "./payment-security.mjs";

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodeSubject(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

export function paymentEmailContent({ order, method, reviewUrl, recipient, fromName }) {
  const date = new Intl.DateTimeFormat("az-AZ", {
    timeZone: "Asia/Baku", dateStyle: "medium", timeStyle: "short"
  }).format(new Date(order.created_at || Date.now()));
  const subject = `Yeni ödəniş yoxlaması — ${order.order_code}`;
  const rows = [
    ["Sifariş ID-si", order.order_code],
    ["Məhsul", order.product_title],
    ["Plan", order.plan_name],
    ["Məbləğ", `${Number(order.amount).toFixed(2)} ${order.currency}`],
    ["Ödəniş üsulu", method.display_name],
    ["Tarix", date],
    ["Çek", "Private sistemə yüklənib"]
  ];
  const textBody = `${subject}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nSifarişi yoxla: ${reviewUrl}`;
  const htmlBody = `<!doctype html><html><body style="margin:0;background:#0c0c0c;color:#f4f4f4;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:28px"><h1 style="font-size:22px;color:#ffd400">Yeni ödəniş yoxlaması</h1><div style="background:#171717;border:1px solid #303030;border-radius:14px;padding:20px">${rows.map(([label, value]) => `<p style="margin:8px 0"><strong>${htmlEscape(label)}:</strong> ${htmlEscape(value)}</p>`).join("")}<p style="margin-top:22px"><a href="${htmlEscape(reviewUrl)}" style="display:inline-block;background:#ffd400;color:#111;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Sifarişi yoxla</a></p></div><p style="color:#999;font-size:12px">Bu keçid sifarişi avtomatik təsdiqləmir. Admin girişi və ayrıca təsdiq əməliyyatı tələb olunur.</p></div></body></html>`;
  return { recipient, subject, textBody, htmlBody, fromName };
}

export function createPaymentMailer(config, store) {
  let timer = null;
  let running = false;

  async function accessToken() {
    const body = new URLSearchParams({
      client_id: config.gmailClientId,
      client_secret: config.gmailClientSecret,
      refresh_token: config.gmailRefreshToken,
      grant_type: "refresh_token"
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new Error(safeText(payload.error_description || payload.error || `Gmail OAuth xətası: ${response.status}`, 500));
    return payload.access_token;
  }

  async function send(row) {
    const boundary = `mirpanel-${crypto.randomUUID()}`;
    const raw = [
      `From: ${encodeSubject(config.gmailFromName)} <${config.gmailSenderEmail}>`,
      `To: ${row.recipient}`,
      `Subject: ${encodeSubject(row.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      row.text_body,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      row.html_body,
      `--${boundary}--`
    ].join("\r\n");
    const token = await accessToken();
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: base64Url(raw) })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(safeText(payload.error?.message || `Gmail göndəriş xətası: ${response.status}`, 500));
    return payload;
  }

  async function processOne() {
    if (running) return false;
    running = true;
    try {
      const row = await store.claimEmail();
      if (!row) return false;
      try {
        await send(row);
        await store.emailSent(row.id);
      } catch (error) {
        await store.emailFailed(row.id, error.message, row.attempts);
      }
      return true;
    } finally {
      running = false;
    }
  }

  return {
    configured: Boolean(config.gmailClientId && config.gmailClientSecret && config.gmailRefreshToken && config.gmailSenderEmail),
    processOne,
    async drain(max = 5) {
      if (!this.configured) return;
      for (let index = 0; index < max; index += 1) if (!(await processOne())) break;
    },
    start() {
      if (!this.configured || timer) return;
      timer = setInterval(() => this.drain(3).catch((error) => console.error("Payment email queue", error.message)), 30_000);
      timer.unref?.();
      this.drain(3).catch((error) => console.error("Payment email queue", error.message));
    },
    stop() { if (timer) clearInterval(timer); timer = null; }
  };
}
