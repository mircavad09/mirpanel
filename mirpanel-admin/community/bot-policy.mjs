// Conservative deterministic rules; not AI and not a claim of exhaustive detection.
export const BOT_ID='mirpanel-system-bot-v1';
export const warnings={profanity:'söhbətdə söyüş qadağandır.',insult:'digər üzvləri təhqir etmək qadağandır.',contact:'əlaqə məlumatı və keçid paylaşmaq qadağandır.',threat:'zorakılıqla hədələmək qadağandır.'};
const normalize=v=>String(v||'').normalize('NFKC').toLocaleLowerCase('az').replace(/[\p{Cf}\p{M}]/gu,'').replace(/ı/g,'i').replace(/ə/g,'e').replace(/ç/g,'c').replace(/ş/g,'s').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ğ/g,'g');
function contact(text){
 const s=normalize(text),compact=s.replace(/\s+/g,''),words=s.replace(/\b(?:dot|noqte|nöqte)\b/g,'.').replace(/\b(?:at|et)\b/g,'@');
 if(/(?:nomrem|telefon|elaqe|whatsapp)\s*[:=]?/.test(s)){const numbers={sifir:'0',bir:'1',iki:'2',uc:'3',dord:'4',bes:'5',alti:'6',yeddi:'7',sekkiz:'8',doqquz:'9'},decoded=s.replace(/\b(sifir|bir|iki|uc|dord|bes|alti|yeddi|sekkiz|doqquz)\b/g,m=>numbers[m]);if(/\d[\d\s().-]{7,}\d/.test(decoded))return true;}
 if(/(?:https?|hxxps?)\s*[:.]?\s*\/\s*\/|www\s*[.]/i.test(s))return true;
 if(/@[\p{L}\d_][\p{L}\d_.]{1,}/u.test(compact))return true;
 if(/[\p{L}\d._%+-]+\s*@\s*[\p{L}\d.-]+\s*[.]\s*[a-z]{2,}/u.test(words))return true;
 // Domain-shaped contact, not every dot/number, and no bare platform-name block.
 if(/(?:[\p{L}\d-]+\s*[.]\s*)+(?:com|az|net|org|io|me|ru|co|app|dev|test|info|biz|xyz)\b/u.test(words))return true;
 if(/(?:instagram|whatsapp|telegram|tiktok|facebook|insta)\s*(?:[:=]|hesabim|nomrem|profilim)\s*[\p{L}\d_+][\p{L}\d_.+-]{2,}/u.test(s))return true;
 // 9–15 digits with phone separators. Dates (YYYY-MM-DD), prices and years pass.
 for(const m of s.matchAll(/(?:\+?\d[\d\s().-]{7,}\d)/g)){const v=m[0].trim(),digits=v.replace(/\D/g,'');if(digits.length>=9&&digits.length<=15&&!/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2})?$/.test(v))return true;}
 if(/(?:nomrem|telefon|elaqe|whatsapp)\s*[:=]?\s*(?:sifir|bir|iki|uc|üç|dord|dörd|bes|beş|alti|yeddi|sekkiz|doqquz)(?:[\s,.-]+(?:sifir|bir|iki|uc|üç|dord|dörd|bes|beş|alti|yeddi|sekkiz|doqquz)){6,}/u.test(s))return true;
 return false;
}
const tokenPattern=word=>new RegExp('(?:^|[^\\p{L}])'+[...word].map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s._*·-]*')+'(?:$|[^\\p{L}])','u');
const profanity=['sik','amciq','siktir','sikim','sikdir','sikmek','sikeyim','orospu','qehbe','peysər'.replace('ə','e'),'fuck','fucking','bitch'];
export function classifyMessage(body){const s=normalize(body);if(contact(body))return'contact';if(/(?:seni|sizi)\s+(?:oldurecem|vuracam|vuracagam|doyecem|bicaqlayacam|oldurmek\s+isteyirem)\b/u.test(s))return'threat';if(profanity.some(w=>tokenPattern(w).test(s)))return'profanity';if(['axmaqsan','alcaqsan','debil','idiotsan'].some(w=>tokenPattern(w).test(s))||/(?:sen|siz|sensen|sizsiniz)\s+(?:bir\s+)?(?:axmaq|alcaq|esek|gic|debil|idiot)(?:san|siniz)?\b/u.test(s)||/(?:^|[^\p{L}])(?:axmaqsan|alcaqsan|debil|idiotsan)(?:$|[^\p{L}])/u.test(s))return'insult';return null;}
export function safeName(value){const s=String(value||'').normalize('NFKC').replace(/[\p{C}<>]/gu,'').trim();if(!s||s.length>80||contact(value)||/admin|operator|moderator|mirpanel|nezaretci|destek|\bbot\b/iu.test(normalize(value)))throw Object.assign(Error('Ad və soyadda əlaqə məlumatı, keçid və xidməti ad istifadə etməyin. Adınızı düzəldin.'),{status:400});return s;}
