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
  ids: "05a7ba54700933fc63488f47277f1966171aa5fc545479f886198efc6946dbe5",
  slugs: "9a69c995ac18ee592f4179a0b9187801add6909cb313a864d1d64ec269a130cc",
  commercial: "b26d2521c3e487ab81cf5b67856fa47a97482c621faf5ef77527a0c0c527837a",
  order: "c23897b7542f359ad8ffdd2c7e6ca324911fcbaba2a3354fc255ef16d3942215",
  stock: "b8b7b095f95ae7ccb0731301ee55e368942289f0861f01879f261dceac337c3d",
  banners: "b73937a9b0f73e7b35a312ffad3f84e3cb4d0a4ea7449a19c9db7bef99d2e817",
  homepage: "fb21b16c7204c21a80a2c05c4b24f518996ae63a8cf3a6f565444423348fa6d4",
  about: "bca55d1f60259522c0c3dda9be4ac7d28e5089e4e0d6697aef07a21b0442dacb",
  contact: "8c4d97ecf6a88bd57eda60526f8561a17c8d70cf28d4465c7733ba481cb371bd",
  terms: "837a935c48adc697ac177d409374d5655ba00d3fba83d96e0b334fbce7b92be3",
  navigation: "7d36eb6554337d2398a0f1102c26b5d9dffae64a01774703eeeb6f6b3ec6027c",
  footer: "408b61c875bd6bd400dae38abfef7a559ba448ae90167d53529201ec33f57b42",
  seo: "64fecb4b92f1d40a0cfb1461468ba3c77f112467eada17acd56dc49439838d98",
  orderSettings: "a7308bf531d01c378eb1da0256ca771414eb6fdd474d75d00bfd4d5b30451520",
  formFields: "a23e837045d204d0de83bd0e8f09b21135fc7e6fabbdce5e5dc9c09e4b17856a"
};

assert.deepEqual(snapshot, expected, "Admin/CMS təhlükəsizlik snapshot-ı dəyişib");
const footerProjection = state.cms.navigation
  .filter((item) => item.showFooter)
  .map(({ showHeader, showFooter, ...item }) => item);
assert.deepEqual(footerProjection, state.cms.footer.links, "Footer keçidləri vahid naviqasiya mənbəyindən yaranmır");
assert.ok(state.cms.navigation.every((item) => typeof item.showHeader === "boolean" && typeof item.showFooter === "boolean"), "Naviqasiya görünüş seçimləri miqrasiya edilməyib");
console.log("PASS: admin/CMS təhlükəsizlik snapshot-ı qorunur.");
