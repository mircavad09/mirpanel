import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

const state = extractAdminState(fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const products = state.products;

const snapshot = {
  counts: {
    total: products.length,
    active: products.filter((product) => product.active !== false).length
  },
  ids: hash(products.map((product) => product.id)),
  slugs: hash(products.map((product) => [product.id, product.seoSlug])),
  commercial: hash(products.map((product) => [product.id, product.currency, product.plans])),
  order: hash(products.map((product) => [product.id, product.order])),
  stock: hash(products.map((product) => [
    product.id,
    product.stock,
    product.stockEnabled,
    product.soldOut,
    product.active
  ])),
  banners: hash(products.map((product) => [product.id, product.banner])),
  homepage: hash(state.cms.homepage),
  about: hash(state.siteSections.haqqimizda),
  contact: hash(state.siteSections.elaqe),
  terms: hash(state.siteSections.sertler),
  navigation: hash(state.cms.navigation),
  footer: hash(state.cms.footer),
  seo: hash([
    state.cms.seo,
    products.map((product) => [
      product.id,
      product.seoTitle,
      product.seoDescription,
      product.seoH1,
      product.seoOgTitle,
      product.seoOgDescription,
      product.seoOgImage,
      product.seoIndex,
      product.includeInSitemap
    ])
  ]),
  orderSettings: hash(state.cms.orderSettings),
  formFields: hash(products.map((product) => [
    product.id,
    product.formFields,
    product.orderFlow,
    product.flow,
    product.confirmationModal,
    product.orderConfirmation
  ]))
};

if (process.argv.includes("--snapshot")) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

const expected = {
  counts: { total: 30, active: 21 },
  ids: "da78ca400e0b22911cdf9bd22391ab61ac6c0d9a4f9f625f65785321986e5288",
  slugs: "313c7ca1d473f1caae9b562a2ff555e12c8f0a950196f0a21024fd46688e78f8",
  commercial: "631093299c676bf26b167d91c0872bccb05997e92c4bffd80eba0bad82cff7f0",
  order: "b67de45e1f435af2ee6991e5d63063907e6fc410c207076a17cae56638231689",
  stock: "fa0e47d96eb6974389935490af25a14d0118c4f8e115fb425e2b003d91b2ed5d",
  banners: "226d8c221849700ffd54834e5d88648ff0097af6ea402a4aa52fbabddc37e53e",
  homepage: "fb21b16c7204c21a80a2c05c4b24f518996ae63a8cf3a6f565444423348fa6d4",
  about: "685a623c95c5a13b84d034e7619b020255f5ce4f4d1aabb993434503c148f8ee",
  contact: "8c4d97ecf6a88bd57eda60526f8561a17c8d70cf28d4465c7733ba481cb371bd",
  terms: "837a935c48adc697ac177d409374d5655ba00d3fba83d96e0b334fbce7b92be3",
  navigation: "7d36eb6554337d2398a0f1102c26b5d9dffae64a01774703eeeb6f6b3ec6027c",
  footer: "408b61c875bd6bd400dae38abfef7a559ba448ae90167d53529201ec33f57b42",
  seo: "fe186afaf27e40b867de0ecfddad7e8492ab9c490e60ebe3b0878d4287da58ad",
  orderSettings: "a7308bf531d01c378eb1da0256ca771414eb6fdd474d75d00bfd4d5b30451520",
  formFields: "2df521d554313a36f92ce209b53e42873aaca6f976fc7de1d7982ac0476b82c9"
};

assert.deepEqual(snapshot, expected, "Admin/CMS təhlükəsizlik snapshot-ı dəyişib");
const footerProjection = state.cms.navigation
  .filter((item) => item.showFooter)
  .map(({ showHeader, showFooter, ...item }) => item);
assert.deepEqual(footerProjection, state.cms.footer.links, "Footer keçidləri vahid naviqasiya mənbəyindən yaranmır");
assert.ok(state.cms.navigation.every((item) => typeof item.showHeader === "boolean" && typeof item.showFooter === "boolean"), "Naviqasiya görünüş seçimləri miqrasiya edilməyib");
console.log("PASS: admin/CMS təhlükəsizlik snapshot-ı qorunur.");
