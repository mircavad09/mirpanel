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

export function nextCalendarDay(date) {
  return shiftCalendarDays(date, 1);
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

function monthBoundary(today, offsetMonths = 0, end = false) {
  const [year, month] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offsetMonths + (end ? 1 : 0), end ? 0 : 1));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

export function orderPeriodRange(period = "", dateFrom = "", dateTo = "", now = new Date()) {
  const today = bakuDate(now);
  if (period === "1d" || period === "today") return { dateFrom: today, dateTo: today };
  if (period === "yesterday") {
    const yesterday = shiftCalendarDays(today, -1);
    return { dateFrom: yesterday, dateTo: yesterday };
  }
  if (period === "7d") return { dateFrom: shiftCalendarDays(today, -6), dateTo: today };
  if (period === "30d") return { dateFrom: shiftCalendarDays(today, -29), dateTo: today };
  if (period === "1m" || period === "this_month") return { dateFrom: monthBoundary(today), dateTo: today };
  if (period === "last_month") return { dateFrom: monthBoundary(today, -1), dateTo: monthBoundary(today, -1, true) };
  if (period === "3m") return { dateFrom: monthBoundary(today, -2), dateTo: today };
  if (period === "6m") return { dateFrom: monthBoundary(today, -5), dateTo: today };
  if (period === "1y" || period === "12m") return { dateFrom: monthBoundary(today, -11), dateTo: today };
  if (period === "all") return { dateFrom: "", dateTo: "" };
  const from = safeCalendarDate(dateFrom);
  const to = safeCalendarDate(dateTo);
  return from && to && from <= to ? { dateFrom: from, dateTo: to } : { dateFrom: "", dateTo: "" };
}

export function bakuDayBounds(date) {
  const safe = safeCalendarDate(date);
  return safe ? {
    start: `${safe}T00:00:00${BAKU_OFFSET}`,
    endExclusive: `${nextCalendarDay(safe)}T00:00:00${BAKU_OFFSET}`
  } : { start: "", endExclusive: "" };
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
