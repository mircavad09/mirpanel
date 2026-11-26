// Static interface SVGs only; no payment or device capability logic.
export function paymentTileIcon(method,el){
 const paths={card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',wallet:'<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-2M3 8h15"/><rect x="13" y="9" width="9" height="7" rx="2"/><path d="M17 12h.01"/>',transfer:'<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>','bank-account':'<path d="m3 8 9-5 9 5H3ZM4 21h16M5 18h14M6 8v10m6-10v10m6-10v10"/>'};
 const span=el('span',null,'payment-tile-icon');span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[method]+'</svg>';return span;
}
