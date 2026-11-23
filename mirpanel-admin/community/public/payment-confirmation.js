const names={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10',card:'Epoint kart',unknown:'Epoint (üsul qeydə alınmayıb)'};
export function renderPaymentConfirmation(host,data){
 if(data?.type!=='mirpanel-confirmation'||!['completed','refunded','partially_refunded'].includes(data.status))throw Error('Təsdiqlənmiş sənəd tapılmadı.');
 const doc=host.ownerDocument,el=(tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n;};
 const money=c=>{const n=BigInt(c);return (n/100n).toString()+','+(n%100n).toString().padStart(2,'0')+' ₼';};
 const date=v=>new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(new Date(v));
 const box=el('section','');box.className='mirpanel-payment-confirmation';box.style.cssText='padding:16px;max-width:560px;width:100%;box-sizing:border-box;overflow-wrap:anywhere;line-height:1.6';
 box.append(el('h2',data.title));const list=el('dl','');
 for(const [label,value]of [['Ödəniş üsulu',names[data.method]||'Epoint'],['Əməliyyat №',data.number],['Epoint əməliyyat №',data.providerTransaction||'Hələ verilməyib'],['Ödənilib',money(data.paidCents)],['Balansa əlavə edilib',money(data.creditedCents)],['Yaradılıb (Bakı)',date(data.createdAt)],['Tamamlanıb (Bakı)',date(data.completedAt)],['Status',({completed:'Tamamlandı',refunded:'Geri qaytarılıb',partially_refunded:'Qismən geri qaytarılıb'})[data.status]]]){const dt=el('dt',label),dd=el('dd',value);dt.style.color='#aaa';dd.style.margin='0 0 10px';list.append(dt,dd);}
 if(data.refundCents>0)list.append(el('dt','Geri qaytarılıb'),el('dd',money(data.refundCents)));
 box.append(list,el('p',data.note));host.replaceChildren(box);
}
