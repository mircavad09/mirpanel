import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

export function commercialSnapshot(source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")) {
  const data = extractAdminState(source);
  const snapshot = {
    products: data.products.map((product) => ({
      id: product.id,
      seoSlug: product.seoSlug,
      plans: product.plans,
      order: product.order,
      stock: product.stock,
      stockEnabled: product.stockEnabled,
      soldOut: product.soldOut,
      active: product.active,
      banner: product.banner
    })),
    siteSections: data.siteSections,
    cms: data.cms
  };
  const serialized = JSON.stringify(snapshot);
  return {
    productCount: data.products.length,
    activeProductCount: data.products.filter((product) => product.active !== false).length,
    sha256: crypto.createHash("sha256").update(serialized).digest("hex"),
    snapshot
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = commercialSnapshot();
  console.log(JSON.stringify({
    productCount: result.productCount,
    activeProductCount: result.activeProductCount,
    sha256: result.sha256
  }, null, 2));
}
