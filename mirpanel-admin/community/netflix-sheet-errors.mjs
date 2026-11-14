// Persist only safe categories, never Google response bodies or account data.
const descriptions={
 headers:['Cədvəlin A, B və C başlıqları uyğun deyil.','Başlıqları Müştəri ID-si, Otaq adı və PIN, Gmail şəklində yoxlayın.'],
 delivery:['Təhvil məlumatı və ya müştəri ID-si tam deyil.','Sifarişin faktiki təhvil qeydini yoxlayın; nümunə məlumatla əvəz etməyin.'],
 missing:['Gmail, otaq adı və PIN üzrə uyğun sətir tapılmadı.','Cədvəldə faktiki təhvilə aid sətri yoxlayın, sonra yenidən yoxlama başladın.'],
 duplicate:['Gmail, otaq adı və PIN üzrə birdən çox sətir tapıldı.','Təkrarlanan sətirləri yoxlayıb yalnız bir uyğun sətir saxlayın.'],
 conflict:['Uyğun sətrin A xanasında başqa dəyər var.','Mövcud müştəri ID-sini yoxlayın. Sistem onu avtomatik dəyişməyəcək.'],
 released:['Bu təhvil artıq otağın cari təhvili deyil.','Cari otaq ayrılmasını yoxlayın; köhnə müştərinin ID-si yazılmayacaq.'],
 permission:['Google Sheets üçün oxuma və ya yazma icazəsi rədd edildi.','Xidmət hesabının bu cədvəldə Redaktor icazəsini və API aktivliyini yoxlayın.'],
 access:['Cədvəlin məhdud giriş qaydası uyğun deyil.','Girişi yalnız şəxsi sahib hesabı və qoşulmuş xidmət hesabı üçün saxlayın.'],
 auth:['Google xidmət hesabının girişi təsdiqlənmədi.','Xidmət hesabının açarını və serverin qorunan sazlamasını yoxlayın.'],
 config:['Google Sheets bağlantısının sazlaması tam deyil.','Serverdə cədvəl ID-si və xidmət hesabı sazlamasını yoxlayın.'],
 destination:['Google cədvəli və ya stok vərəqi tapılmadı.','Cədvəlin linkini, giriş icazəsini və stok vərəqini yoxlayın.'],
 identity:['Sabit otaq ID-si ilə Gmail, otaq adı və PIN uyğun gəlmir.','Cədvəldə həmin otağın sətirini yoxlayın; sistem qeyri-müəyyən sətri dəyişməyəcək.'],
 date:['Hesabın bitmə tarixi məlum deyil və ya etibarsızdır.','Admin paneldə tarixi yoxlayın. Cədvəldəki düzgün tarix dəyişdirilməyib.'],
 quota:['Google sorğu limiti müvəqqəti dolub.','Sistem fasilədən sonra avtomatik yenidən cəhd edəcək.'],
 timeout:['Google Sheets cavabı vaxt həddini keçdi.','Sistem avtomatik yenidən cəhd edəcək.'],
 verify:['Yazının cədvəldən geri oxunması təsdiqlənmədi.','Sistem təkrar oxuyub yoxlayacaq; yeni sifariş və ya təhvil yaradılmayacaq.'],
 connection:['Google Sheets bağlantısı müvəqqəti uğursuz oldu.','Sistem avtomatik yenidən cəhd edəcək.'],
 pending:['İlkin yoxlama növbəsindədir.','Sistem faktiki təhvilin uyğun sətrini yoxlayacaq.']
};
const transient=new Set(['connection','quota','timeout','verify','pending']);
export function sheetReason(error){
 if(error?.sheetReason)return error.sheetReason;
 const code=String(error?.message||error||'');
 const known={ROOM_SHEET_AUTH:'auth',ROOM_SHEET_ACCESS:'access',ROOM_SHEET_CONFIG:'config',ROOM_SHEET_DESTINATION:'destination',ROOM_SHEET_HEADERS:'headers',ROOM_SHEET_MISSING:'missing',ROOM_SHEET_DUPLICATE:'duplicate',ROOM_SHEET_DUPLICATE_ID:'duplicate',ROOM_SHEET_OWNER_CONFLICT:'conflict',ROOM_SHEET_IDENTITY_CONFLICT:'identity',ROOM_SHEET_DATA:'delivery',ROOM_SHEET_DATE_MISSING:'date',ROOM_SHEET_DATE_INVALID:'date',ROOM_SHEET_WRITE_NOT_CONFIRMED:'verify',ROOM_SHEET_REQUEST:'connection',ROOM_SHEET_RETRY:'connection',sheets:'connection'};
 if(known[code])return known[code];
 if(descriptions[code])return code;
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'timeout';
 return 'connection';
}
export function sheetIssue(reason,state='pending'){
 const key=reason?sheetReason(reason):'pending';
 const [message,fix]=descriptions[key]||descriptions.connection;
 return {reason:key,message,fix,needsReview:state==='blocked'||!transient.has(key)};
}
export const retryableSheetReason=reason=>transient.has(reason);
