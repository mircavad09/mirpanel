import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { commercialSnapshot } from "./payment-commercial-snapshot.mjs";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { generateProductPageFiles } from "../mirpanel-admin/product-pages.mjs";

const source = fs.readFileSync(new URL("../payment-flow.js", import.meta.url), "utf8");
const methods = { methods: [{ id: "test-only", providerName: "TEST BANK", last4: "0000", available: true }], anyAvailable: true };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
function harness(fetcher) {
  const delays = [];
  const context = vm.createContext({ window: {}, fetch: fetcher, AbortController, DOMException, console,
    setTimeout(fn, ms) { delays.push(ms); return setTimeout(fn, ms >= 12000 ? 15 : 1); }, clearTimeout });
  vm.runInContext(source.replace("window.MirpanelPaymentFlow = {", "window.testRequest = request; window.MirpanelPaymentFlow = {"), context);
  return { request: context.window.testRequest, delays };
}
let tests = 0;
// Reproduce the published bug, rather than assuming the report is the cause.
const oldSource = execFileSync("git", ["show", "origin/main:payment-flow.js"], { encoding: "utf8" });
if (oldSource.includes("response.json().catch(() => ({}))")) {
  const oldContext = vm.createContext({ window: {}, fetch: async () => new Response("<html>Service waking up</html>", { headers: { "Content-Type": "text/html" } }) });
  vm.runInContext(oldSource.replace("window.MirpanelPaymentFlow = {", "window.testRequest = request; window.MirpanelPaymentFlow = {"), oldContext);
  assert.equal(JSON.stringify(await oldContext.window.testRequest("/api/payments/methods")), "{}", "Old HTML response was incorrectly accepted");
  tests++;
}
for (const mode of ["html", "empty", "broken-json", "invalid-shape", "500", "offline", "timeout"]) {
  let calls = 0;
  const h = harness(async (_, options) => {
    calls++;
    assert.equal(options.headers["Content-Type"], undefined, "GET does not need a preflight-triggering JSON header");
    if (mode === "offline") throw new TypeError("network down");
    if (mode === "timeout") return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError"))));
    if (mode === "500") return json({ error: "internal" }, 503);
    if (mode === "invalid-shape") return json({});
    if (mode === "broken-json") return new Response("{", { headers: { "Content-Type": "application/json" } });
    return new Response(mode === "html" ? "<html>Service waking up</html>" : "", { headers: { "Content-Type": "text/html" } });
  });
  await assert.rejects(h.request("/api/payments/methods"), /Ödəniş xidməti hazırda cavab vermir/);
  assert.equal(calls, 3, mode);
  assert.deepEqual(h.delays.filter((ms) => ms < 12000), [2000, 4000]);
  tests++;
}
for (const result of [methods, { methods: [], anyAvailable: false }, { methods: [{ ...methods.methods[0], available: false }], anyAvailable: false }]) {
  assert.deepEqual(await harness(async () => json(result)).request("/api/payments/methods"), result); tests++;
}
let calls = 0;
const recovery = harness(async () => ++calls < 3 ? json({}, 502) : json(methods));
assert.deepEqual(await recovery.request("/api/payments/methods"), methods);
assert.equal(calls, 3); tests++;
for (const status of [401, 403, 429]) {
  let count = 0;
  await assert.rejects(harness(async () => { count++; return json({ error: "blocked" }, status); }).request("/api/payments/methods"));
  assert.equal(count, 1); tests++;
}
let writes = 0;
const write = harness(async () => { writes++; throw new TypeError("offline"); });
await assert.rejects(write.request("/api/payments/reservations", { method: "POST", headers: { "X-Idempotency-Key": "fixed" }, body: "{}" }));
assert.equal(writes, 1); tests++;
const controller = new AbortController(); controller.abort();
await assert.rejects(harness(async () => { throw new Error("must not fetch"); }).request("/api/payments/methods", { signal: controller.signal }), { name: "AbortError" }); tests++;

const loginSource = fs.readFileSync(new URL("../mirpanel-admin/public/login.js", import.meta.url), "utf8");
for (const mode of ["html", "timeout", "401", "429", "500", "empty", "success"]) {
  let submit;
  const elements = { loginForm: { addEventListener(_, fn) { submit = fn; } }, loginBtn: { disabled: false }, loginError: {setAttribute(){},removeAttribute(){}}, username: { value: "test" }, password: { value: "test" } };
  const location = { search: "", href: "" };
  const context = vm.createContext({ document: { getElementById: (id) => elements[id] }, location, URLSearchParams, AbortController,
    setTimeout: (fn) => setTimeout(fn, 15), clearTimeout,
    fetch: async (_, options) => {
      if (mode === "timeout") return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError"))));
      if (mode === "html") return new Response("<html>waking</html>");
      if (mode === "empty") return json({});
      if (mode === "success") return json({ ok: true });
      return json({ error: "private upstream error" }, Number(mode));
    } });
  vm.runInContext(loginSource, context);
  let prevented = false;
  await submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(elements.password.value, "test");
  assert.equal(location.href, mode === "success" ? "/admin.html" : "");
  if (mode !== "success") {
    assert.equal(elements.loginBtn.disabled, false);
    assert.match(elements.loginError.textContent, mode === "401" ? /şifrə yanlışdır/ : mode === "429" ? /Çox sayda/ : /xidməti hazırda cavab vermir/);
  }
  tests++;
}
const { boundedReadFetch } = await import("../mirpanel-admin/bounded-read-fetch.mjs");
const originalFetch = globalThis.fetch;
try {
  for (const [url, method, bounded] of [
    ["https://test.invalid/rest/v1/payment_methods", "GET", true],
    ["https://test.invalid/rest/v1/rpc/consume_payment_rate_limit", "POST", true],
    ["https://test.invalid/rest/v1/rpc/confirm_payment_order", "POST", false]
  ]) {
    let count = 0;
    globalThis.fetch = async (_, options) => {
      count++;
      assert.equal(Boolean(options.signal), bounded);
      throw new TypeError("isolated upstream failure");
    };
    await assert.rejects(boundedReadFetch(url, { method }));
    assert.equal(count, 1, "Upstream requests are never automatically replayed");
    tests++;
  }
} finally { globalThis.fetch = originalFetch; }
const before = execFileSync("git", ["show", "origin/main:app.js"], { encoding: "utf8", maxBuffer: 20e6 });
const after = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const beforeCommercial = commercialSnapshot(before);
const afterCommercial = commercialSnapshot(after);
assert.equal(afterCommercial.sha256, beforeCommercial.sha256, "Qiymət/stok/sıra/banner/SEO kommersiya məlumatı dəyişib");
assert.equal(afterCommercial.productCount, beforeCommercial.productCount, "Məhsul sayı dəyişib");
assert.equal(afterCommercial.activeProductCount, beforeCommercial.activeProductCount, "Aktiv məhsul sayı dəyişib");
const snapshot = commercialSnapshot(after);
const data = extractAdminState(after);
const pages = generateProductPageFiles(data.products, data.siteSections, data.cms, data.content);
for (const [name, html] of pages) {
  assert.match(html, /payment-flow.js\?v=four-card-queue-20260902-1/, name);
  assert.match(html, /payment-flow.css\?v=receipt-ux-20260902-1/, name);
}
console.log(JSON.stringify({ ok: true, tests, generatedPages: pages.size, commercialHash: snapshot.sha256, products: snapshot.productCount, activeProducts: snapshot.activeProductCount }, null, 2));
