import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "mirpanel-admin", "public");
const playwrightPath = process.env.MIRPANEL_PLAYWRIGHT_PATH;
if (!playwrightPath) throw new Error("MIRPANEL_PLAYWRIGHT_PATH təyin edilməyib.");
const { chromium } = await import(pathToFileURL(playwrightPath));
const originalState = extractAdminState(fs.readFileSync(path.join(root, "app.js"), "utf8"));
const capcutId = originalState.products.find((product) => /capcut/i.test(product.title))?.id;
assert.ok(capcutId, "CapCut məhsulu tapılmadı");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nPAAAAAASUVORK5CYII=", "base64");
let draftState = null;
let draftConflict = false;
let failNextUpload = false;
let failNextDraft = false;
let uploadCounter = 0;
const uploadPaths = [];
const draftRequests = [];

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (request, response) => {
  if (request.url === "/favicon.ico") { response.writeHead(204); return response.end(); }
  if (request.url === "/api/admin/state") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({
      data: draftState || originalState,
      sha: "local-app-blob-sha",
      currentSha: draftConflict ? "changed-app-blob-sha" : "local-app-blob-sha",
      draftSaved: Boolean(draftState),
      draftConflict,
      pendingUploads: uploadPaths.map((item) => item.filePath),
      csrfToken: "test",
      loadedAt: new Date().toISOString()
    }));
  }
  if (request.url === "/api/admin/banner-draft" && request.method === "POST") {
    const body = await readJson(request);
    if (failNextDraft) {
      failNextDraft = false;
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      return response.end(JSON.stringify({ error: "Sınaq draft xətası" }));
    }
    draftRequests.push(structuredClone(body));
    draftState = structuredClone(draftState || originalState);
    const product = draftState.products.find((item) => item.id === body.productId);
    product.banner = structuredClone(body.banner);
    draftState.cms.media = structuredClone(body.media);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ draftSaved: true, productId: body.productId, banner: product.banner, draftConflict, currentSha: draftConflict ? "changed-app-blob-sha" : body.baseSha }));
  }
  if (request.url === "/api/upload-product-image" && request.method === "POST") {
    await readJson(request);
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (failNextUpload) {
      failNextUpload = false;
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      return response.end(JSON.stringify({ error: "Sınaq upload xətası" }));
    }
    uploadCounter += 1;
    const stamp = 1900000000000 + uploadCounter;
    const filePath = `uploads/products/banner-test-${stamp}-${uploadCounter}.png`;
    const item = { filePath, publicPath: `/${filePath}?v=${stamp}` };
    uploadPaths.push(item);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ ...item, path: `${filePath}?v=${stamp}`, previewDataUrl: `data:image/png;base64,${tinyPng.toString("base64")}`, uploadedAt: new Date().toISOString() }));
  }
  if (request.url?.startsWith("/api/admin/pending-image")) {
    response.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    return response.end(tinyPng);
  }
  if (request.url === "/api/admin/preview" && request.method === "POST") {
    await readJson(request);
    if (draftConflict) {
      response.writeHead(409, { "Content-Type": "application/json; charset=utf-8" });
      return response.end(JSON.stringify({ error: "Məzmun GitHub-da dəyişib. Dəyişiklikləriniz qorunub." }));
    }
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ previewDigest: "local-preview", productCount: 30, activeProductCount: 21, pageCount: 26, warnings: [] }));
  }
  if (request.url === "/api/admin/save" && request.method === "POST") {
    await readJson(request);
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ error: "Sınaq publish xətası" }));
  }
  if (request.url?.startsWith("/api/")) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify({ items: [] }));
  }
  const requested = request.url === "/" ? "/admin.html" : request.url.split("?")[0];
  const file = path.resolve(publicDir, `.${requested}`);
  if (!file.startsWith(publicDir) || !fs.existsSync(file)) { response.writeHead(404); return response.end("Not found"); }
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  return response.end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true, executablePath: process.env.MIRPANEL_BROWSER_PATH });
const consoleErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("https://mirpanel.com/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/+/, "");
    const localFile = path.resolve(root, pathname);
    if (localFile.startsWith(root) && fs.existsSync(localFile) && fs.statSync(localFile).isFile()) return route.fulfill({ path: localFile });
    return route.fulfill({ status: 204, body: "" });
  });
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/admin.html`, { waitUntil: "networkidle" });
  await page.locator('.navBtn[data-view="banners"]').click();
  const capcutEdit = page.locator(`[data-edit-product-banner="${capcutId}"]`);
  if (await capcutEdit.count()) await capcutEdit.click();
  await page.getByText("Banner şəkli", { exact: true }).waitFor();
  assert.equal(await page.getByText("Desktop banner önizləməsi", { exact: true }).count(), 0);
  assert.equal(await page.locator(".bannerAdvanced").evaluate((element) => element.open), false, "Mobil override standart açıqdır");
  assert.ok(await page.getByText("Şəkil kitabxanasından seç", { exact: true }).count());

  const mainEditor = page.locator("#bannerProductEditor .bannerImageEditor").first();
  const choices = mainEditor.locator(".bannerMediaChoice");
  assert.ok(await choices.count() > 1, "Şəkil kitabxanasında test üçün seçim yoxdur");
  await mainEditor.locator(".bannerMediaLibrary summary").click();
  await choices.nth(1).click();
  assert.equal(await choices.nth(1).getAttribute("class").then((value) => value.includes("active")), true, "Kitabxana seçimi aktiv görünmür");

  const altInput = page.locator('#bannerProductEditor input[data-product-banner$=".alt"]');
  const savedAlt = `Banner workflow ${Date.now()}`;
  await altInput.fill(savedAlt);
  await page.locator("[data-save-banner]").click();
  await page.getByText("Yayımlanmağa hazırdır", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.navBtn[data-view="banners"]').click();
  assert.equal(await page.locator('#bannerProductEditor input[data-product-banner$=".alt"]').inputValue(), savedAlt, "Yadda saxlanmış banner reload zamanı itdi");

  let mainUpload = page.locator('#bannerProductEditor input[data-banner-upload$=".desktopImage"]');
  const uploadFile = { name: "eyni-ad.png", mimeType: "image/png", buffer: tinyPng };
  await mainUpload.setInputFiles(uploadFile);
  assert.equal(await page.locator("#changeStatus").innerText(), "Şəkil yüklənir", "Fayl seçilən anda dirty/upload statusu yaranmadı");
  await page.locator("[data-save-banner]").evaluate((button) => button.click());
  await page.getByText("Yayımlanmağa hazırdır", { exact: true }).waitFor();
  assert.equal(draftRequests.length > 0, true, "Upload-dan sonra banner draft endpoint-i çağırılmadı");
  const firstUploadedPath = uploadPaths[0].publicPath;
  assert.equal(draftRequests.at(-1).productId, capcutId, "Draft yanlış məhsul ID-si ilə göndərildi");
  assert.equal(draftRequests.at(-1).banner.desktopImage, firstUploadedPath, "Yeni server şəkil yolu banner draft payload-ına yazılmadı");
  assert.equal(await page.locator("#toasts").getByText("Yadda saxlanacaq banner dəyişikliyi yoxdur.", { exact: true }).count(), 0, "Şəkil seçildiyi halda dəyişiklik yoxdur xətası göstərildi");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.navBtn[data-view="banners"]').click();
  const capcutEditAfterReload = page.locator(`[data-edit-product-banner="${capcutId}"]`);
  if (await capcutEditAfterReload.count()) await capcutEditAfterReload.click();
  const reloadedPreview = await page.locator('#bannerProductEditor [data-banner-preview$=".desktopImage"]').first().getAttribute("src");
  assert.equal(draftState.products.find((product) => product.id === capcutId).banner.desktopImage, firstUploadedPath, "Server draft yaddaşında yeni banner yolu itdi");
  assert.ok(reloadedPreview?.includes("/api/admin/pending-image?path="), "Səhifə yeniləndikdən sonra yeni banner önizləməsi itdi");

  mainUpload = page.locator('#bannerProductEditor input[data-banner-upload$=".desktopImage"]');
  await mainUpload.setInputFiles(uploadFile);
  await page.getByText("Şəkil bannerə əlavə edildi və Media bölməsində saxlanıldı.", { exact: true }).waitFor();
  assert.equal(new Set(uploadPaths.map((item) => item.filePath)).size, 2, "Eyni adlı upload üçün unikal yol yaranmadı");

  failNextUpload = true;
  mainUpload = page.locator('#bannerProductEditor input[data-banner-upload$=".desktopImage"]');
  await mainUpload.setInputFiles(uploadFile);
  await page.getByText("Sınaq upload xətası", { exact: true }).waitFor();
  assert.equal(await page.locator("#changeStatus").innerText(), "Şəkil yüklənmədi — köhnə banner qorunub", "Upload xətası dürüst status göstərmədi");

  await page.locator('#bannerProductEditor [data-clear-banner-image$=".desktopImage"]').click();
  await page.getByRole("heading", { name: "Banner şəklini sil" }).waitFor();
  await page.locator("#modalConfirm").click();
  await page.waitForTimeout(300);
  const fallbackPreview = await page.locator('#bannerProductEditor [data-banner-preview$=".desktopImage"]').first().getAttribute("src");
  assert.ok(fallbackPreview && !fallbackPreview.includes("banner-test-"), "Şəkil silindikdə məhsul fallback-i önizləməyə qayıtmadı");

  failNextDraft = true;
  await page.locator("[data-save-banner]").click();
  await page.getByText("Sınaq draft xətası", { exact: true }).waitFor();
  assert.equal(await page.locator("#changeStatus").innerText(), "Yadda saxlanmamış dəyişiklik var", "Draft xətasında dəyişiklik state-i qorunmadı");
  await page.locator("[data-save-banner]").click();
  await page.getByText("Yayımlanmağa hazırdır", { exact: true }).waitFor();
  await page.locator("#saveBtn").click();
  await page.getByRole("heading", { name: "Dəyişiklikləri yoxlayın" }).waitFor();
  await page.locator("#modalConfirm").click();
  await page.getByText("Sınaq publish xətası", { exact: true }).waitFor();
  assert.equal(await page.locator('#bannerProductEditor input[data-product-banner$=".alt"]').inputValue(), savedAlt, "Publish xətasında banner state-i itdi");
  assert.ok((await page.locator("#changeStatus").innerText()).includes("dəyişiklikləriniz qorunub"));
  await page.locator("#modalCancel").click();

  draftConflict = true;
  await page.locator('#bannerProductEditor input[data-product-banner$=".alt"]').fill(`${savedAlt} conflict`);
  await page.locator("[data-save-banner]").click();
  await page.getByText("Yayımlama dayandırılıb — GitHub məlumatı dəyişib", { exact: true }).waitFor();
  await page.locator("#saveBtn").click();
  await page.locator("#toasts").getByText("Məzmun GitHub-da dəyişib. Dəyişiklikləriniz qorunub.", { exact: true }).waitFor();
  assert.equal(await page.locator('#bannerProductEditor input[data-product-banner$=".alt"]').inputValue(), `${savedAlt} conflict`, "SHA konfliktində banner state-i itdi");

  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const offenders = overflow > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map((element) => `${element.tagName}.${element.className} right=${Math.round(element.getBoundingClientRect().right)}`)) : [];
    assert.ok(overflow <= 1, `${viewport.width}px admin görünüşündə ${overflow}px üfüqi daşma var: ${offenders.join(", ")}`);
  }
  const unexpectedErrors = consoleErrors.filter((message) => !message.includes("favicon") && !message.includes("status of 500") && !message.includes("status of 409"));
  assert.deepEqual(unexpectedErrors, [], `Brauzer xətaları: ${consoleErrors.join(" | ")}`);
  console.log("PASS: banner upload, kitabxana seçimi, sil/fallback, draft reload, publish failure, SHA konflikt və responsive admin brauzer testi.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
