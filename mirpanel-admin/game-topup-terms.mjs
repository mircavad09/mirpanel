export function gameTopupTerms(product,fields){
 if(!fields.some(field=>field.key==='player_id'&&field.required))return null;
 const pubg=product.id==='pubg_mobile'||product.supplier?.gameId===4&&/^\d+\s+UC$/i.test(product.title);
 const credit=pubg?'UC':'Oyun valyutası';
 return {
  warning:credit+' yalnız yazdığın oyunçu ID-yə yüklənir. Hesab adı göstərilirsə, ödənişdən əvvəl onun sənə aid olduğuna əmin ol.',
  rules:[
   'Hesab şifrəsi, e-poçt və ya giriş məlumatı istənmir. Bu məlumatları heç kimə vermə.',
   'Sifariş ödənişdən sonra avtomatik icra olunur. Yükləmə müddəti təchizatçının cavabından asılıdır.',
   'Düzgün ID-yə uğurla yüklənmiş '+credit+' geri qaytarılmır və başqa hesaba köçürülmür.',
   'Sifarişin statusunu **Sifarişlərim** bölməsində və e-poçt bildirişlərində izləyə bilərsən.',
   'Balansla ödənişdə komissiya yoxdur.',
   'Problem olarsa, sifariş nömrəsi ilə canlı dəstəyə yaz.'
  ]
 };
}
