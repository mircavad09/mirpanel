// Bound upstream reads and the fail-closed login limiter; never retry mutations.
export async function boundedReadFetch(input, init = {}) {
  const method = String(init.method || input?.method || "GET").toUpperCase();
  const url = String(input?.url || input);
  const bounded = ["GET", "HEAD"].includes(method) || url.endsWith("/rpc/consume_payment_rate_limit");
  if (!bounded) return fetch(input, init);
  const timeout = AbortSignal.timeout(15000);
  return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
}
