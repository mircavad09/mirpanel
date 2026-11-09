import {checkoutFields} from './community/public/checkout-fields.js';

// Only the order snapshot contains the values. Catalogue data is a legacy label fallback.
export function adminOrderFields(order, catalog, security, reveal) {
  const snapshot = order.checkout_snapshot || {};
  const lines = snapshot.cartVersion === 2 && Array.isArray(snapshot.items) ? snapshot.items : [snapshot];
  return lines.map((line, index) => {
    const product = catalog.products?.find(p => p.id === (line.productId || order.product_id));
    const plan = product?.plans?.find(p => p.id && p.id === (line.planId || order.plan_id)) ??
      product?.plans?.[line.planIndex ?? (/^\d+$/.test(order.plan_id) ? Number(order.plan_id) : -1)];
    const fields = Array.isArray(line.fields) ? line.fields : product ? checkoutFields(product, plan) : [];
    const values = line.detailsCipher ? JSON.parse(security.decryptSecret(line.detailsCipher)) : {};
    const data = Object.entries(values).filter(([,value]) => typeof value === 'string' && value.length).map(([key,value], field) => {
      const def = fields.find(f => f.key === key || f.label === key);
      const label = def?.label || key;
      const sensitive = !!(def?.sensitive || def?.digits || def?.type === 'password' || /pin|password|passcode|şifrə|sifre|(?:^|[^a-z])code|kod/iu.test(key+' '+label));
      return {field,label,sensitive,value:sensitive && !(reveal?.line === index && reveal.field === field) ? null : value};
    });
    return {index,fields:data};
  });
}
