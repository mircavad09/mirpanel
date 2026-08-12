import crypto from "node:crypto";

const allowedReceiptTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"]
]);

function decodeKey(value, name) {
  const buffer = Buffer.from(String(value || ""), "base64");
  if (buffer.length !== 32) throw new Error(`${name} 32-bayt Base64 açar olmalıdır.`);
  return buffer;
}

export function createPaymentSecurity(config) {
  const encryptionKey = decodeKey(config.encryptionKey, "PAYMENT_ENCRYPTION_KEY_B64");
  const tokenKey = decodeKey(config.tokenSecret, "PAYMENT_TOKEN_SECRET_B64");

  return {
    encryptNumber(value) {
      const normalized = normalizePaymentNumber(value);
      if (normalized.length < 4 || normalized.length > 32) throw new Error("Kart/cüzdan nömrəsi düzgün deyil.");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
    },
    decryptNumber(value) {
      const [version, ivPart, tagPart, encryptedPart] = String(value || "").split(".");
      if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) throw new Error("Şifrəli nömrə formatı düzgün deyil.");
      const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivPart, "base64url"));
      decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64url")),
        decipher.final()
      ]).toString("utf8");
    },
    hashToken(value) {
      return crypto.createHmac("sha256", tokenKey).update(String(value || "")).digest("hex");
    },
    randomToken(bytes = 32) {
      return crypto.randomBytes(bytes).toString("base64url");
    },
    ipHash(value) {
      return crypto.createHmac("sha256", tokenKey).update(`ip:${String(value || "unknown")}`).digest("hex");
    }
  };
}

export function normalizePaymentNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

export function validatePaymentNumber(value, type = "bank_card") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^[0-9 ]+$/.test(raw)) throw Object.assign(new Error("Kart/cüzdan nömrəsində yalnız rəqəm və boşluq istifadə edin."), { status: 400 });
  const digits = normalizePaymentNumber(raw);
  const minimum = type === "wallet" ? 7 : 12;
  const maximum = 19;
  if (digits.length < minimum || digits.length > maximum) {
    throw Object.assign(new Error(`Kart/cüzdan nömrəsi ${minimum}–${maximum} rəqəm olmalıdır.`), { status: 400 });
  }
  return digits;
}

export function maskedPaymentNumber(last4) {
  return `•••• •••• •••• ${String(last4 || "").slice(-4)}`;
}

export function publicPaymentNumber(value, type) {
  const digits = normalizePaymentNumber(value);
  if (type === "wallet") return digits;
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export function safeText(value, max = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function safeMultiline(value, max = 4000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
}

export function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#151515";
}

export function safeUuid(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text) ? text : "";
}

export function orderCode() {
  return `MP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function receiptFromPayload(body, maxBytes = 5 * 1024 * 1024) {
  const mimeType = String(body?.mimeType || "").toLowerCase();
  const expectedExtension = allowedReceiptTypes.get(mimeType);
  if (!expectedExtension) throw Object.assign(new Error("Yalnız JPG, PNG, WEBP və PDF qəbul edilir."), { status: 400 });
  const raw = String(body?.contentBase64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  if (!raw) throw Object.assign(new Error("Ödəniş qəbzi seçilməyib."), { status: 400 });
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > maxBytes) {
    throw Object.assign(new Error("Qəbz maksimum 5 MB ola bilər."), { status: buffer.length > maxBytes ? 413 : 400 });
  }
  return receiptFromBuffer(buffer, mimeType, maxBytes);
}

export function receiptFromBuffer(buffer, declaredMimeType, maxBytes = 5 * 1024 * 1024) {
  const mimeType = String(declaredMimeType || "").toLowerCase();
  if (!allowedReceiptTypes.has(mimeType)) throw Object.assign(new Error("Yalnız JPG, PNG, WEBP və PDF qəbul edilir."), { status: 400 });
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxBytes) {
    throw Object.assign(new Error("Qəbz maksimum 5 MB ola bilər."), { status: buffer?.length > maxBytes ? 413 : 400 });
  }
  const detected = detectReceiptType(buffer);
  if (!detected || detected.mimeType !== mimeType) {
    throw Object.assign(new Error("Faylın real formatı seçilmiş formatla uyğun deyil."), { status: 400 });
  }
  if (!hasValidReceiptStructure(buffer, detected.extension)) {
    throw Object.assign(new Error("Fayl zədələnib və ya tam yüklənməyib."), { status: 400 });
  }
  if (detected.extension === "pdf") {
    const sample = buffer.subarray(0, Math.min(buffer.length, 1_000_000)).toString("latin1");
    if (/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i.test(sample)) {
      throw Object.assign(new Error("Aktiv məzmun daşıyan PDF qəbul edilmir."), { status: 400 });
    }
  }
  return {
    buffer,
    mimeType: detected.mimeType,
    extension: detected.extension,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex")
  };
}

function hasValidReceiptStructure(buffer, extension) {
  if (extension === "jpg") return buffer.lastIndexOf(Buffer.from([0xff, 0xd9])) >= 3;
  if (extension === "png") return buffer.length >= 24 && buffer.subarray(12, 16).toString("ascii") === "IHDR";
  if (extension === "webp") {
    const declaredSize = buffer.readUInt32LE(4);
    return declaredSize >= 4 && declaredSize + 8 <= buffer.length;
  }
  if (extension === "pdf") return buffer.subarray(Math.max(0, buffer.length - 4096)).toString("latin1").includes("%%EOF");
  return false;
}

export function detectReceiptType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: "image/png", extension: "png" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { mimeType: "application/pdf", extension: "pdf" };
  return null;
}
