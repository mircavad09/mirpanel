// Consumable top-ups, vouchers, Stars and site tokens are not subscriptions,
// even when an old catalogue row happens to contain a default month value.
export const renewalProductAllowed=(p,plan)=>!!p&&p.id!=='mirpanel_token'&&!/^epinby_/.test(p.id)&&p.supplier?.provider!=='epinby'&&plan?.supplier?.provider!=='epinby'&&!(p.plans?.length&&p.plans.every(x=>x.supplier?.provider==='epinby'));
