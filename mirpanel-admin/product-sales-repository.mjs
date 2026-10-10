export const HISTORICAL_TOTAL = 10000;
const priority = new Set(['capcut', 'spotify', 'netflix']);
const failure = (message, status = 400) => Object.assign(new Error(message), {status});
export function weightedAllocation(products) {
  const ids = Array.from(products).filter(p => p.active !== false).map(p => String(p.id)).sort();
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !id)) throw failure('Aktiv canonical məhsul siyahısı etibarsızdır.');
  const totalWeight = ids.reduce((sum, id) => sum + (priority.has(id) ? 5 : 1), 0);
  const rows = ids.map(id => { const weight = priority.has(id) ? 5 : 1, numerator = HISTORICAL_TOTAL * weight;
    return {product_id:id, count:Math.floor(numerator / totalWeight), weight, remainder:numerator % totalWeight}; });
  let remaining = HISTORICAL_TOTAL - rows.reduce((sum,row) => sum + row.count, 0);
  [...rows].sort((a,b) => b.remainder-a.remainder || (a.product_id < b.product_id ? -1 : 1))
    .forEach(row => { if (remaining > 0) { row.count++; remaining--; } });
  return rows.map(({remainder, ...row}) => row);
}
export function validateAllocation(items) {
  if (!Array.isArray(items) || !items.length || items.length > 1000 || new Set(items.map(r=>r.product_id)).size !== items.length)
    throw failure('Məhsul siyahısı etibarsızdır.');
  if (items.some(r => typeof r.product_id !== 'string' || !r.product_id || !Number.isSafeInteger(r.count) || r.count < 0))
    throw failure('Tarixi saylar mənfi olmayan tam rəqəm olmalıdır.');
  const sum = items.reduce((s,r)=>s+r.count,0);
  if (sum !== HISTORICAL_TOTAL) throw failure(`Cəm 10.000 olmalıdır. Fərq: ${HISTORICAL_TOTAL-sum}.`);
  return items.map(r=>({product_id:r.product_id,count:r.count}));
}
export function createProductSalesRepository(client, {loadCatalog}) {
  async function rpc(name,args={}) {
    const {data,error} = await client.rpc(name,args);
    if (error) {
      const known = {SALES_TOTAL_INVALID:'Tarixi cəm dəqiq 10.000 olmalıdır.',SALES_VERSION_CONFLICT:'Statistika başqa admin tərəfindən dəyişdirilib. Yeniləyib təkrar cəhd edin.',SALES_NOT_INITIALIZED:'Əvvəl tarixi bölgünü yaradın.',SALES_PRODUCTS_INVALID:'Canonical məhsul siyahısı etibarsızdır.'};
      const code = Object.keys(known).find(k => String(error.message).includes(k));
      console.error('PRODUCT_SALES_RPC_FAILED', name, error.code || 'UNKNOWN');
      throw failure(known[code] || 'Satış statistikası xidməti hazır deyil. Migration tətbiqini yoxlayın.', code ? 409 : 503);
    }
    return data;
  }
  async function snapshot() {
    const [raw,catalog] = await Promise.all([rpc('product_sales_snapshot'),loadCatalog()]);
    const names = new Map(catalog.products.map(p=>[p.id,p]));
    const counts = new Map((raw.real || []).map(r=>[r.product_id,Number(r.count)]));
    const baseline = new Map((raw.baselines || []).map(r=>[r.product_id,Number(r.count)]));
    const ids = new Set([...names.keys(),...baseline.keys()]);
    const unknownProductIds = [...counts].filter(([id])=>!names.has(id))
      .map(([productId,real])=>({productId,real})).sort((a,b)=>String(a.productId).localeCompare(String(b.productId)));
    return {...raw, unknownProductIds, products:[...ids].map(id=>({productId:id,title:names.get(id)?.title || id,
      active:names.get(id)?.active !== false && names.has(id),historical:baseline.get(id)||0,real:counts.get(id)||0,
      total:(baseline.get(id)||0)+(counts.get(id)||0)})),realTotal:Number(raw.realTotal)||0,
      total:(raw.initializedAt ? HISTORICAL_TOTAL : 0)+(Number(raw.realTotal)||0)};
  }
  return {
    snapshot,
    async publicProduct(id) {
      const data = await snapshot(), product = data.products.find(p=>p.productId===id && p.active);
      if (!product) throw failure('Məhsul tapılmadı.',404);
      return {initialized:!!data.initializedAt, productId:id,historical:product.historical,real:product.real,
        productTotal:product.total,siteTotal:data.total};
    },
    async initialize(actor) {
      const catalog = await loadCatalog();
      await rpc('product_sales_initialize',{p_allocation:weightedAllocation(catalog.products),p_actor:actor});
      return snapshot();
    },
    async save(body,actor) {
      const items = validateAllocation(body.items), current = await snapshot();
      const allowed = new Set(current.products.map(p=>p.productId));
      if (items.some(r=>!allowed.has(r.product_id)) || current.products.some(p=>!items.some(r=>r.product_id===p.productId)))
        throw failure('Bütün məhsulların tarixi sayları birlikdə göndərilməlidir.');
      if (!Number.isSafeInteger(body.version)) throw failure('Statistika versiyası etibarsızdır.');
      await rpc('product_sales_save',{p_allocation:items,p_actor:actor,p_version:body.version});
      return snapshot();
    }
  };
}
