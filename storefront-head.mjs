export const storefrontIcon='/assets/logo.png';
const icon='<link rel="icon" type="image/png" href="'+storefrontIcon+'">';
const placeholder='<div class="account-header-controls account-guest-controls" data-account-session-bootstrap><span class="account-session-placeholder" role="status" aria-label="Hesab yoxlanılır"><i></i><i></i></span></div>';

export function withStorefrontHead(html){
 const hasHeader=html.includes('class="site-header-tools"');
 const styles=hasHeader?'<link rel="stylesheet" href="/account-header.css?v=storefront-identity-1" data-shell-persistent>':'';
 const page=html.replace(/<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>/gi,'')
  .replace(/(<meta charset=["'][^"']+["']\s*\/?>)/i,'$1'+icon+styles);
 return hasHeader?page.replace('<div class="site-header-tools">','<div class="site-header-tools">'+placeholder):page;
}
