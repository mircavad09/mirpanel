import {displayMoney,exactMoney} from './epinby-finance.mjs';
const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

export function decimalToCents(value) {
  const text = String(value ?? "0").trim();
  const match = DECIMAL.exec(text);
  if (!match) throw new TypeError("Maliyyə məbləği düzgün decimal formatında deyil.");
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}

export function centsToMoney(cents) {
  const value = BigInt(cents);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function normalizedMetric(row = {}) {
  const revenueCents = decimalToCents(row.revenue ?? 0);
  const costCents = decimalToCents(row.cost ?? 0);
  const incomplete = Number(row.missingCostCount || 0) > 0;
  const profitCents = revenueCents - costCents;
  return {
    ...row,
    revenue: centsToMoney(revenueCents),
    cost: centsToMoney(costCents),
    profit: incomplete && row.profit === null ? null : row.exactSupplierTotals ? row.profit : centsToMoney(profitCents),
    margin: incomplete || revenueCents === 0n ? null : Number((Number(profitCents * 10000n / revenueCents) / 100).toFixed(2))
  };
}

export function normalizeFinancialStatistics(statistics = {}) {
  const normalized = normalizedMetric(statistics);
  return {
    ...normalized,
    count: Number(statistics.count || 0),
    missingCostCount: Number(statistics.missingCostCount || 0),
    estimatedCostCount: Number(statistics.estimatedCostCount || 0),
    topProduct: statistics.topProduct || "—",
    topProfitProduct: statistics.topProfitProduct || "—",
    products: (statistics.products || []).map(normalizedMetric),
    plans: (statistics.plans || []).map(normalizedMetric),
    paymentMethods: (statistics.paymentMethods || []).map(normalizedMetric),
    days: (statistics.days || []).map(normalizedMetric)
  };
}

export function aggregateSnapshotRows(rows = []) {
  let revenueCents = 0n;
  let costCents = 0n;
  let count = 0;
  for (const row of rows) {
    if (!['approved', 'completed'].includes(row.status) || !row.completed_at) continue;
    revenueCents += decimalToCents(row.sale_price_snapshot ?? row.amount ?? 0);
    costCents += decimalToCents(row.cost_price_snapshot ?? 0);
    count += 1;
  }
  return {
    count,
    revenue: centsToMoney(revenueCents),
    cost: centsToMoney(costCents),
    profit: centsToMoney(revenueCents - costCents)
  };
}

export function reportOrderFinance(order,refundCents=0,supplierLines){
 const result=productFinance(order,refundCents,supplierLines),payment=order.checkout_snapshot?.epointPayment;
 // Immutable payment-time fee, never a balance movement or a retrospective tariff.
 const cents=payment?.paid===true&&['apple-pay','m10'].includes(payment.method)&&payment.feeBasisPoints===300&&Number.isSafeInteger(payment.feeCents)&&payment.feeCents>=0?payment.feeCents:0;
 if(!cents)return result;
 const fee=exactMoney(centsToMoney(cents));
 const withFee=(row,amount)=>({...row,
  payment_fee_snapshot:displayMoney(amount),payment_fee_source:payment.feeSource,
  cost_price_snapshot:row.cost_price_snapshot==null?null:displayMoney(exactMoney(row.cost_price_snapshot)+amount),
  known_cost_snapshot:displayMoney((row.exactKnownCost??exactMoney(row.known_cost_snapshot))+amount),
  profit_snapshot:row.profit_snapshot==null?null:displayMoney(exactMoney(row.profit_snapshot)-amount),
  ...(row.exactKnownCost!=null?{exactKnownCost:row.exactKnownCost+amount}:{})});
 const output=withFee(result,fee);
 if(result.financeLines?.length){
  const total=result.financeLines.reduce((n,row)=>n+decimalToCents(row.sale_price_snapshot),0n);let assigned=0n;
  output.financeLines=result.financeLines.map((row,index)=>{const share=index===result.financeLines.length-1?BigInt(cents)-assigned:total?BigInt(cents)*decimalToCents(row.sale_price_snapshot)/total:0n;assigned+=share;return withFee(row,exactMoney(centsToMoney(share)));});
 }
 return output;
}
function productFinance(order, refundCents = 0, supplierLines) {
  const sale = decimalToCents(order.sale_price_snapshot ?? order.amount);
  const refunded = BigInt(refundCents);
  const revenue = sale > refunded ? sale - refunded : 0n;
  const cancelled = new Map((order.fulfillment_cancellation?.lines || []).map(line => [line.index, line.quantity]));
  let cost = order.cost_price_snapshot == null ? null : decimalToCents(order.cost_price_snapshot);
  let knownCost = cost ?? 0n;
  let estimated = order.cost_source === "backfilled_current_cost";
  if(supplierLines?.size){
    const evidence=[];
    const lineResults=[];
    const details=order.cart_items||[];
    let knownExact=0n,missing=false;
    estimated=false;
    const length=Math.max(details.length,order.cost_lines_snapshot?.length||0,1,...[...supplierLines.keys()].map(i=>i+1));
    for(let index=0;index<length;index++){
      const line=order.cost_lines_snapshot?.[index], detailsLine=details[index];
      const quantity=Number(detailsLine?.quantity??line?.quantity??order.quantity??1);
      const retained=quantity-(cancelled.get(index)||0);
      if(retained<=0)continue;
      let lineCost=0n,unknown=false,lineEstimated=false;
      if(supplierLines.has(index)){
        const units=supplierLines.get(index).filter(u=>u.state==='delivered');
        const costs=units.map(u=>{
          const saved=u.supplier_charge??u.execution_quote;
          if(saved?.azn==null)unknown=true;
          else{lineCost+=exactMoney(saved.azn);lineEstimated||=saved.source==='execution_quote';}
          return saved??{reason:'Bu Epinby əməliyyatının qiyməti saxlanmayıb.'};
        });
        unknown||=units.length!==retained;
        if(units.length!==retained)costs.push({reason:'Bütün təhvil vahidləri üçün Epinby qiymət sübutu yoxdur.'});
        evidence.push({lineIndex:index,costs});
      }else if(line?.unitCost!=null){
        lineCost=exactMoney(line.unitCost)*BigInt(retained);
        lineEstimated=line.source==='estimate';
      }else unknown=true;
      knownExact+=lineCost;missing||=unknown;estimated||=lineEstimated;
      lineResults.push({line:detailsLine,retained,cost:lineCost,missing:unknown,estimated:lineEstimated});
    }
    const profit=exactMoney(centsToMoney(revenue))-knownExact;
    const lineRevenue=lineResults.reduce((sum,{line,retained})=>sum+BigInt(line?.unitCents||0)*BigInt(retained),0n);
    // Use checkout line totals only when they reconcile to the actual order revenue.
    const financeLines=details.length&&lineResults.every(x=>x.line)&&lineRevenue===revenue?lineResults.map(({line,retained,cost,missing,estimated})=>({
      ...order, product_id:line.productId,product_title:line.title,plan_id:line.sourcePlanKey??line.planIndex,plan_name:line.planName,
      sale_price_snapshot:centsToMoney(BigInt(line.unitCents)*BigInt(retained)),
      cost_price_snapshot:missing?null:displayMoney(cost),known_cost_snapshot:displayMoney(cost),
      profit_snapshot:missing?null:displayMoney(exactMoney(centsToMoney(BigInt(line.unitCents)*BigInt(retained)))-cost),
      exactKnownCost:cost,estimated_cost:estimated
    })):null;
    return {...order,sale_price_snapshot:centsToMoney(revenue),cost_price_snapshot:missing?null:displayMoney(knownExact),
      known_cost_snapshot:displayMoney(knownExact),profit_snapshot:missing?null:displayMoney(profit),
      exactKnownCost:knownExact,estimated_cost:estimated,costEvidence:evidence,financeLines};
  }
  if (Array.isArray(order.cost_lines_snapshot)) {
    knownCost = 0n;
    estimated = false;
    let missing = false;
    for (const [index,line] of order.cost_lines_snapshot.entries()) {
      const retained = line.quantity - (cancelled.get(index) || 0);
      if (retained <= 0) continue;
      if (line.unitCost == null) missing = true;
      else {
        knownCost += decimalToCents(line.unitCost) * BigInt(retained);
        estimated ||= line.source === "estimate";
      }
    }
    cost = missing ? null : knownCost;
  } else if (cost !== null && cancelled.has(0) && order.product_id !== "__cart__") {
    const quantity = BigInt(order.quantity || 1);
    cost = (cost * (quantity - BigInt(cancelled.get(0))) + quantity / 2n) / quantity;
    knownCost = cost;
  }
  return {
    ...order,
    sale_price_snapshot: centsToMoney(revenue),
    cost_price_snapshot: cost === null ? null : centsToMoney(cost),
    known_cost_snapshot: centsToMoney(knownCost),
    profit_snapshot: cost === null ? null : centsToMoney(revenue - cost),
    estimated_cost: estimated
  };
}
