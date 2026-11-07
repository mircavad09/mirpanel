export const accountLabels={profile:'Profil',orders:'Sifarişlərim',codes:'Kodlarım',subscriptions:'Abunəliklərim',payments:'Ödənişlərim',expenses:'Xərclərim'};
export function accountTab(search){
 const name=new URLSearchParams(search).get('tab');
 return Object.hasOwn(accountLabels,name)?name:'profile';
}
export const accountTabPath=tab=>'/profil'+(tab==='profile'?'':'?tab='+tab);
export function profileShell(search){
 const active=accountTab(search);
 const links=Object.entries(accountLabels).map(([tab,label])=>'<a class="account-tab" data-account-tab="'+tab+'" href="'+accountTabPath(tab)+'"'+(active===tab?' aria-current="page"':'')+'>'+label+'</a>').join('');
 return '<div class="account-panel"><aside class="account-sidebar"><div class="account-sidebar-card account-identity-pending" aria-hidden="true"></div><nav class="account-tabs" aria-label="Hesab bölmələri">'+links+'</nav></aside><section class="account-tab-content"><h1>'+accountLabels[active]+'</h1><div class="account-skeleton" aria-busy="true" aria-label="Hesab məlumatı"></div></section></div>';
}
export const profileCSS='/community-assets/account-panel.css?v=profile-start-20261108';
