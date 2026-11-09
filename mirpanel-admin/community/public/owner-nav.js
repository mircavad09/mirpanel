// The exact same menu component is used on public and authenticated pages.
if(!document.querySelector('script[data-browser-nav-loader]')){const s=document.createElement('script');s.src='/browser-nav.js?v=capcut-mobile-guide-1';s.dataset.browserNavLoader='true';document.head.append(s);}
