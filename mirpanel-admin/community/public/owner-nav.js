// The exact same menu component is used on public and authenticated pages.
if(!document.querySelector('script[data-browser-nav-loader]')){const s=document.createElement('script');s.src='/browser-nav.js?v=shared-nav-20261029';s.dataset.browserNavLoader='true';document.head.append(s);}
