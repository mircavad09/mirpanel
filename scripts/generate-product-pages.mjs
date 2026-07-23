import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import {
  generateProductPageFiles,
  generateRedirects,
  generateSitemap
} from "../mirpanel-admin/product-pages.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
const state = extractAdminState(appSource);
const pages = generateProductPageFiles(state.products);

for (const [filePath, content] of pages) {
  const absolutePath = path.join(projectRoot, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

fs.writeFileSync(
  path.join(projectRoot, "sitemap.xml"),
  generateSitemap(state.products, state.siteSections),
  "utf8"
);
fs.writeFileSync(
  path.join(projectRoot, "_redirects"),
  generateRedirects(state.products, state.siteSections),
  "utf8"
);

console.log(`Generated ${pages.size} active product pages.`);
