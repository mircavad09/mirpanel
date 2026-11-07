const identity = value => String(value ?? "").trim().toLowerCase();
const titleKey = value => identity(value).normalize("NFKD").replace(/\p{M}/gu, "").replaceAll("ə", "e").replaceAll("ı", "i").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const historicalTitles = {
  netflix: ["Netflix Şəxsi hesab", "Netflix Şəxsi otaq"],
  spotify: ["Spotify Premium"],
  adobecc: ["Adobe CC"]
};

export function orderProductMatcher(selectedId, catalog = []) {
  const selected = identity(selectedId);
  const ids = new Map(), aliases = new Map(), titles = new Map();
  function register(map, key, id) {
    if (!key) return;
    if (map.has(key) && map.get(key) !== id) map.set(key, null);
    else map.set(key, id);
  }
  for (const product of catalog) {
    const id = identity(product.id);
    if (!id) continue;
    ids.set(id, id);
    for (const slug of [product.seoSlug, product.slug]) register(aliases, identity(slug), id);
    for (const title of [product.title, product.name, ...(historicalTitles[id] || [])]) register(titles, titleKey(title), id);
  }
  function recognizedId(storedId) {
    const id = identity(storedId);
    return id === selected ? selected : ids.get(id) || aliases.get(id);
  }
  function matches(storedId, title, snapshotId) {
    const recognized = recognizedId(storedId) || recognizedId(snapshotId);
    if (recognized) return recognized === selected;
    return titles.get(titleKey(title)) === selected || titles.get(titleKey(storedId)) === selected;
  }
  return row => {
    const items = row.cart_items ?? row.checkout_snapshot?.items;
    if (Array.isArray(items) && items.length) return items.some(item => matches(item?.productId, item?.title));
    if (identity(row.product_id) === "__cart__") return false;
    return matches(row.product_id, row.product_title, row.snapshot_product ?? row.checkout_snapshot?.productId);
  };
}
