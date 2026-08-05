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
  ids: "83531c4949da51270042ea3e4c722de6bfb3a4c12bdc279d2db3d1d34a724221",
  slugs: "c1f9bde1eefaacdb377e058474cf3420a64a93d3c3beb6535d1b67a3a860807e",
  commercial: "647cc9efb3c33fd923eeebceac4358b8c792ba065972fe5dc0a8f918cc303ef8",
  order: "06637bdd0c20ac392eeb351c40138e8699934f7734667529c9da96872e3e7b7c",
  stock: "3b7bf7d7b01b9984020c636aac8720ba28ed44f64853bf3e61646742c7a1748c",
  banners: "7ccf71080ae9ec3539fefd6b60b444cd739f81104b7eb448053caf9c59f376ee",
  homepage: "fb21b16c7204c21a80a2c05c4b24f518996ae63a8cf3a6f565444423348fa6d4",
  about: "ae84637710025f13a52b0eac0e1f296aa27e1c5f4c70a16348d40294cad4a89d",
  contact: "8c4d97ecf6a88bd57eda60526f8561a17c8d70cf28d4465c7733ba481cb371bd",
  terms: "837a935c48adc697ac177d409374d5655ba00d3fba83d96e0b334fbce7b92be3",
  navigation: "7d36eb6554337d2398a0f1102c26b5d9dffae64a01774703eeeb6f6b3ec6027c",
  footer: "408b61c875bd6bd400dae38abfef7a559ba448ae90167d53529201ec33f57b42",
  seo: "aa3d78a62cf52f0e53b5f4b5fe4a09b9f0c65a31d8eac46a5793b1c74482d3cd",
  orderSettings: "a7308bf531d01c378eb1da0256ca771414eb6fdd474d75d00bfd4d5b30451520",
  formFields: "e63eb2310cd70ae73710bad4dbbab415a68f7b7d5c160f6600df9f97f2dc1d3f"
};

assert.deepEqual(snapshot, expected, "Admin/CMS təhlükəsizlik snapshot-ı dəyişib");
const footerProjection = state.cms.navigation
  .filter((item) => item.showFooter)
  .map(({ showHeader, showFooter, ...item }) => item);
assert.deepEqual(footerProjection, state.cms.footer.links, "Footer keçidləri vahid naviqasiya mənbəyindən yaranmır");
assert.ok(state.cms.navigation.every((item) => typeof item.showHeader === "boolean" && typeof item.showFooter === "boolean"), "Naviqasiya görünüş seçimləri miqrasiya edilməyib");
console.log("PASS: admin/CMS təhlükəsizlik snapshot-ı qorunur.");
