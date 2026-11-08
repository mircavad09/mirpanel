export const accountLabels={profile:'Profil',orders:'Sifarişlərim',codes:'Kodlarım',subscriptions:'Abunəliklərim',payments:'Ödənişlərim',expenses:'Xərclərim'};
export function accountTab(search){
 const name=new URLSearchParams(search).get('tab');
 return Object.hasOwn(accountLabels,name)?name:'profile';
}
export const accountTabPath=tab=>'/profil'+(tab==='profile'?'':'?tab='+tab);
export function profileReturn(search){
 const tab=accountTab(search),code=new URLSearchParams(search).get('order');
 return tab==='orders'&&/^[A-Za-z0-9-]{1,40}$/.test(code||'')?'/profil?tab=orders&order='+code:accountTabPath(tab);
}
export const profileLoader='<div class="account-tab-spinner" role="status" aria-label="Məlumat hazırlanır"></div>';
export function profileShell(search){
 const active=accountTab(search);
 const links=Object.entries(accountLabels).map(([tab,label])=>'<a class="account-tab" data-account-tab="'+tab+'" href="'+accountTabPath(tab)+'"'+(active===tab?' aria-current="page"':'')+'>'+label+'</a>').join('');
 return '<div class="account-panel"><aside class="account-sidebar"><div class="account-sidebar-card account-identity-pending" aria-hidden="true"></div><nav class="account-tabs" aria-label="Hesab bölmələri">'+links+'</nav></aside><section class="account-tab-content"><h1>'+accountLabels[active]+'</h1>'+profileLoader+'</section></div>';
}
export const profileCSS='/community-assets/account-panel.css?v=profile-footer-space-1';
