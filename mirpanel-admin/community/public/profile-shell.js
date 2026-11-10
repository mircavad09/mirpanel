export const accountLabels={profile:'Profilim',orders:'Sifarişlərim',codes:'Kodlarım',subscriptions:'Abunəliklərim',payments:'Ödənişlərim',expenses:'Xərclərim'};
const tabIconPaths = {
 profile: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 21v-2a7 7 0 0 1 14 0v2',
 orders: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M8 5l9 4',
 codes: 'M14.5 14a5.5 5.5 0 1 0-4.7-2.6L3 18v3h4v-3h3l2.8-4.3a5.5 5.5 0 0 0 1.7.3z M16 8h.1',
 subscriptions: 'M11 21H4V5h16v6 M8 3v4 M16 3v4 M4 9h16 M22 17a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M17 14.5V17l1.5 1',
 payments: 'M3 5h18v14H3z M3 10h18 M7 15h3',
 expenses: 'M3 20h18 M5 20v-7h3v7 M10.5 20V9h3v11 M16 20V4h3v16',
};
export function accountTabIcon(tab) {
 return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+tabIconPaths[tab]+'"></path></svg>';
}
export function accountTab(search){
 const name=new URLSearchParams(search).get('tab');
 return Object.hasOwn(accountLabels,name)?name:'profile';
}
export const accountTabPath=tab=>'/profil'+(tab==='profile'?'':'?tab='+tab);
export function profileReturn(search){
 const topup=new URLSearchParams(search).get('topup');
 if(accountTab(search)==='payments'&&/^[a-f0-9-]{36}$/i.test(topup||''))return '/profil?tab=payments&topup='+topup;
 const tab=accountTab(search),code=new URLSearchParams(search).get('order');
 return tab==='orders'&&/^[A-Za-z0-9-]{1,40}$/.test(code||'')?'/profil?tab=orders&order='+code:accountTabPath(tab);
}
export const profileLoader='<div class="account-tab-spinner" role="status" aria-label="Məlumat hazırlanır"></div>';
export function accountMenu(active){
 const links=Object.entries(accountLabels).map(([tab,label])=>{
  const heading=tab==='orders'?'<span class="account-menu-heading">ALIŞ-VERİŞ</span>':tab==='payments'?'<span class="account-menu-heading">BALANS</span>':'';
  return heading+'<a class="account-tab" data-account-tab="'+tab+'" href="'+accountTabPath(tab)+'"'+(active===tab?' aria-current="page"':'')+'>'+accountTabIcon(tab)+'<span>'+label+'</span></a>';
 }).join('');
 return links+'<hr class="account-menu-divider"><button type="button" class="account-tab account-menu-logout"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 21H4V3h5 M13 7l5 5-5 5 M8 12h13"></path></svg><span>Çıxış</span></button><span class="account-menu-status" role="status"></span>';
}
export function profileShell(search){
 const active=accountTab(search);
 const links=accountMenu(active);
 return '<div class="account-panel"><aside class="account-sidebar"><div class="account-sidebar-card account-identity-pending" aria-hidden="true"></div><nav class="account-tabs" aria-label="Hesab bölmələri">'+links+'</nav></aside><section class="account-tab-content"><h1>'+accountLabels[active]+'</h1>'+profileLoader+'</section></div>';
}
export const profileCSS='/community-assets/account-panel.css?v=profile-menu-3';
