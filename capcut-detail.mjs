// Display-only service milestone; never contributes to order or sales counts.
export function serviceHoursMilestone(now = Date.now(), start = '2024-01-01T00:00:00+04:00') {
  const since = Date.parse(start), current = Number(now);
  if (!Number.isFinite(since) || !Number.isFinite(current) || current < since) return null;
  return Math.floor(Math.floor((current - since) / 3600000) / 1000) * 1000;
}
