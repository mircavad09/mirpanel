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
  counts: { total: 31, active: 22 },
  ids: "fda2a68a0801c1c4e032b3ea00ff773cfb3c16d221fc9ca272f23682043d7933",
  slugs: "ec658036904d4748530679681056ddd38b300893e7c5295ae7d33ebfc93bea2e",
  commercial: "e23f5f30f096a00b1b0d440154fec8cfb0461794f0cecf9056213df0ef187726",
  order: "d6343f4612ea717cab34dcec52c6b71a1c68bc915a2e66755560afe8ecad7dd7",
  stock: "7b85f157f1cf84ca5dc37ab7eb40cb173aae5b1e394b79a7b4978434342ae91c",
  banners: "1c0c6faf0251ef4c8c6215dbb470b675aecacfdd4ff2b97d0ca9b6bf26c6a7a2",
  homepage: "4bd6e8e8dc072d0ca17dec73fb1304f68edb053815fdd39258402fbf0aa2ddb8",
  about: "ae84637710025f13a52b0eac0e1f296aa27e1c5f4c70a16348d40294cad4a89d",
  contact: "8c4d97ecf6a88bd57eda60526f8561a17c8d70cf28d4465c7733ba481cb371bd",
  terms: "837a935c48adc697ac177d409374d5655ba00d3fba83d96e0b334fbce7b92be3",
  navigation: "7d36eb6554337d2398a0f1102c26b5d9dffae64a01774703eeeb6f6b3ec6027c",
  footer: "408b61c875bd6bd400dae38abfef7a559ba448ae90167d53529201ec33f57b42",
  seo: "77984fc6082ba2c000936d2ba435f8c9a34334b0a82c0ce6d3f3d5e08b233664",
  orderSettings: "a7308bf531d01c378eb1da0256ca771414eb6fdd474d75d00bfd4d5b30451520",
  formFields: "a65f4879d97283e0c21e580265908aeca76c44560d182a383d68d55ce676a600"
};

assert.deepEqual(snapshot, expected, "Admin/CMS təhlükəsizlik snapshot-ı dəyişib");
const footerProjection = state.cms.navigation
  .filter((item) => item.showFooter)
  .map(({ showHeader, showFooter, ...item }) => item);
assert.deepEqual(footerProjection, state.cms.footer.links, "Footer keçidləri vahid naviqasiya mənbəyindən yaranmır");
assert.ok(state.cms.navigation.every((item) => typeof item.showHeader === "boolean" && typeof item.showFooter === "boolean"), "Naviqasiya görünüş seçimləri miqrasiya edilməyib");
console.log("PASS: admin/CMS təhlükəsizlik snapshot-ı qorunur.");
