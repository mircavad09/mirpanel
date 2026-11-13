export const storefrontIcon='/assets/logo.png';
const icon='<link rel="icon" type="image/png" href="'+storefrontIcon+'">';
const placeholder='<div class="account-header-controls account-guest-controls" data-account-session-bootstrap><span class="account-session-placeholder" role="status" aria-label="Hesab yoxlanılır"><i></i><i></i></span></div>';

const walletPlaceholder='<a class="account-mobile-balance" href="/balans" aria-label="Balans yoxlanılır" aria-busy="true"><span class="account-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4z M4 6V3h13 M15 11h5v5h-5z"/></svg></span><span class="account-mobile-balance-copy"><small>Balans</small><strong>—</strong></span></a>';

export function withStorefrontHead(html){
 const hasHeader=html.includes('class="site-header-tools"');
 const styles=hasHeader?'<link rel="stylesheet" href="/account-header.css?v=mobile-wallet-inline-3" data-shell-persistent>':'';
 const page=html.replace(/<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>/gi,'')
  .replace(/<link\b[^>]*\bhref=["']\/?account-header\.css(?:\?[^"']*)?["'][^>]*>/gi,'')
  .replace(/(<meta charset=["'][^"']+["']\s*\/?>)/i,'$1'+icon+styles);
 return hasHeader?page.replace('<div class="site-header-tools">','<div class="site-header-tools">'+placeholder)
  .replace(/(<a\b[^>]*class="[^"]*site-header-brand[^"]*"[^>]*>[\s\S]*?<\/a>)/,'$1'+walletPlaceholder):page;
}
