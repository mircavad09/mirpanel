// Public status contains no employee identity, customer data or delivery secrets.
export function customerOrderStatus(paymentStatus, reviewState) {
  if (['approved','completed'].includes(paymentStatus)) return 'Sifarişiniz uğurla tamamlandı.';
  if (['rejected','cancelled'].includes(paymentStatus)) return 'Sifarişiniz ləğv edilib.';
  if (paymentStatus==='expired') return 'Sifarişin vaxtı bitib.';
  if (reviewState==='DELIVERED_PENDING_ADMIN') return 'Sifarişiniz təqdim edilib. Admin təsdiqi gözlənilir.';
  return 'Sifarişiniz yoxlanılır.';
}
