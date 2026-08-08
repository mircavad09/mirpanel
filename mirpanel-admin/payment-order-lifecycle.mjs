const BAKU_OFFSET = "+04:00";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function safeCalendarDate(value) {
  const text = String(value || "");
  if (!DATE_PATTERN.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? text : "";
}

export function bakuDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(value instanceof Date ? value : new Date(value));
}

export function shiftCalendarDays(date, days) {
  const safe = safeCalendarDate(date);
  if (!safe) return "";
  const [year, month, day] = safe.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

export function addCalendarMonthsMinusDay(date, months) {
  const safe = safeCalendarDate(date);
  const count = Number.parseInt(String(months || ""), 10);
  if (!safe || !Number.isInteger(count) || count < 1 || count > 120) return "";
  const [year, month, day] = safe.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 + count, 1));
  const lastTargetDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const anniversary = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastTargetDay)));
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return `${anniversary.getUTCFullYear()}-${pad(anniversary.getUTCMonth() + 1)}-${pad(anniversary.getUTCDate())}`;
}

export function serviceDates(completedAt, durationMonths) {
  const completedOn = bakuDate(completedAt);
  const expiresOn = addCalendarMonthsMinusDay(completedOn, durationMonths);
  return {
    completedOn,
    expiresOn: expiresOn || null,
    notificationOn: expiresOn ? shiftCalendarDays(expiresOn, -1) : null
  };
}

function monthPeriodStart(today, months) {
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const sameDay = `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
  return shiftCalendarDays(sameDay, 1);
}

export function orderPeriodRange(period = "", dateFrom = "", dateTo = "", now = new Date()) {
  const today = bakuDate(now);
  if (period === "1d") return { dateFrom: today, dateTo: today };
  if (period === "7d") return { dateFrom: shiftCalendarDays(today, -6), dateTo: today };
  if (period === "1m") return { dateFrom: monthPeriodStart(today, 1), dateTo: today };
  if (period === "3m") return { dateFrom: monthPeriodStart(today, 3), dateTo: today };
  if (period === "6m") return { dateFrom: monthPeriodStart(today, 6), dateTo: today };
  if (period === "1y") return { dateFrom: monthPeriodStart(today, 12), dateTo: today };
  const from = safeCalendarDate(dateFrom);
  const to = safeCalendarDate(dateTo);
  return from && to && from <= to ? { dateFrom: from, dateTo: to } : { dateFrom: "", dateTo: "" };
}

export function bakuDayBounds(date) {
  const safe = safeCalendarDate(date);
  return safe ? { start: `${safe}T00:00:00${BAKU_OFFSET}`, end: `${safe}T23:59:59.999${BAKU_OFFSET}` } : { start: "", end: "" };
}

export function expiryStatus(expiresOn, now = new Date()) {
  const safe = safeCalendarDate(expiresOn);
  if (!safe) return { due: false, code: "unknown", label: "Müddət müəyyən edilməyib" };
  const today = bakuDate(now);
  if (safe <= today) return { due: true, code: "expired", label: "Müddəti bitib" };
  if (shiftCalendarDays(today, 1) === safe) return { due: true, code: "tomorrow", label: "Sabah bitir" };
  return { due: false, code: "active", label: "Aktivdir" };
}

export function structuredDurationMonths(plan) {
  const months = Number(plan?.durationMonths ?? plan?.months);
  return Number.isInteger(months) && months >= 1 && months <= 120 ? months : null;
}
