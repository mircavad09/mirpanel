class PaymentScriptInjector {
  element(element) {
    const src = element.getAttribute("src") || "";
    if (src.includes("order-confirmation.js")) {
      element.before('<script src="/admin-payment-order.js?v=payment-order-20260607-1"></script>', { html: true });
    }
  }
}

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on('script[src*="order-confirmation.js"]', new PaymentScriptInjector())
    .transform(response);
}
