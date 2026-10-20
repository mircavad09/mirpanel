/* Presentation only: never write these labels back to catalog/order data. */
(function (root) {
  function normalizeDisplayLabel(value) {
    return String(value ?? '')
      .replace(/\bayl[iı]q\b/gi, 'aylıq')
      .replace(/\byoutube\b/gi, 'YouTube')
      .replace(/\bTelefon\s*&\s*Kompyuter\b/gi, 'Telefon və kompüter')
      .replace(/\bkompyuter\b/gi, 'kompüter')
      .replace(/\bQənayət\b/gi, 'qənaət')
      .replace(/\bmehsul\b/gi, word => /^[A-Z]/.test(word) ? 'Məhsul' : 'məhsul')
      .replace(/\bsifaris\b/gi, word => /^[A-Z]/.test(word) ? 'Sifariş' : 'sifariş');
  }
  if (typeof module === 'object' && module.exports) module.exports = { normalizeDisplayLabel };
  if (!root?.document) return;
  if (root.normalizeDisplayLabel) return;
  root.normalizeDisplayLabel = normalizeDisplayLabel;
  // Deliberately exclude forms, banners, admin and data/script attributes.
  const scope = '.card,.product-page-root,.product-page-panel,.product-page-faq,#pp-content-box,#pp-similar-list';
  function normalizeTree(element) {
    [element, ...element.querySelectorAll('[title],[aria-label]')].forEach(el => {
      if (el.closest('form,.modal,#mForm')) return;
      for (const name of ['title','aria-label']) if (el.hasAttribute(name)) {
        const old = el.getAttribute(name), next = normalizeDisplayLabel(old);
        if (next !== old) el.setAttribute(name, next);
      }
    });
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script,style,textarea,input,[contenteditable],form,.modal,#mForm')) continue;
      const next = normalizeDisplayLabel(node.data);
      if (next !== node.data) node.data = next;
    }
  }
  function start() {
    document.querySelectorAll(scope).forEach(normalizeTree);
    const pending = new Set();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const parent = target?.closest(scope);
        if (parent) pending.add(parent);
        for (const node of record.addedNodes) if (node.nodeType === 1) {
          if (node.matches(scope)) pending.add(node);
          node.querySelectorAll(scope).forEach(el => pending.add(el));
        }
      }
      pending.forEach(normalizeTree); pending.clear();
    });
    observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})(typeof window === 'undefined' ? null : window);
