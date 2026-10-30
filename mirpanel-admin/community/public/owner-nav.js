// The exact same menu component is used on public and authenticated pages.
if(!document.querySelector('script[data-browser-nav-loader]')){const s=document.createElement('script');s.src='/browser-nav.js?v=desktop-header-20261031';s.dataset.browserNavLoader='true';document.head.append(s);}
