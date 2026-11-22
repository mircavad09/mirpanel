// Public factual purchase guidance. No testimonials, ratings or partner claims.
import {planName} from './product-plan-view.mjs';
import {planMetrics} from './mirpanel-admin/public/product-plan-utils.mjs';
const extraTopics={
 youtube:['YouTube Premium','YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil.','Sifarişdə tələb olunan Google hesabı məlumatlarını yalnız qorunan sifariş formasında yazın. Aktivləşdirmədən sonra məhz həmin hesabla YouTube-a daxil olub abunəlik vəziyyətini yoxlayın.'],
 mirpanel_token:['MirPanel Token','MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil.','Paketdəki token sayını və yekun AZN qiymətini yoxlayın. Ödəniş təsdiqləndikdən sonra hesabınızdakı token vəziyyətini yoxlayın; dəstəyə müraciətdə sifariş nömrəsini göstərin.'],
 chatgpt_ortaq:['ChatGPT Plus ortaq hesab','Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır.','Paylaşılan girişdə hesabın şifrəsini və digər istifadəçilərin məlumatlarını dəyişməyin. İcazə verilən istifadə formasını təhvil təlimatından yoxlayın.'],
 claude_ai:['Claude AI','Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir.','Giriş formatı və istifadə limiti dəqiqləşdirildikdən sonra təhvil təlimatını izləyin. Paket adı göstərilməyən əlavə model və limitlər vəd edilmir.'],
 youtube_sexsi:['YouTube Premium yenilənməsi','Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil.','Əvvəlki abunəliyin hansı Google hesabına aid olduğunu və yenilənmə müddətini operatorla dəqiqləşdirin.'],
 adobecc:['Adobe Creative Cloud','Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir.','Paketə daxil olan tətbiqləri və hesabın giriş formasını dəqiqləşdirin; təsdiqlənməyən əlavə proqram və yaddaş həcmi daxil sayılmır.'],
 tiktok_jeton:['TikTok Jeton','TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil.','TikTok istifadəçi identifikatorunu və jeton sayını təsdiqdən əvvəl tutuşdurun. Hesabınızda yüklənməni yoxlayıb uyğunsuzluğu sifariş nömrəsi ilə bildirin.'],
 google_ai_ultra:['Google AI Ultra + VEO 3','Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir.','Model, video limiti və hesab formatı təsdiqlənmədən satınalma qərarı verməyin. Hazırda müsbət qiymətli paket yoxdur.'],
 captions:['Captions AI','Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir.','Pro və Max paket adlarını ayırın. Aktivləşdirmədən sonra aldığınız səviyyənin hesabda göründüyünü yoxlayın; əlavə istifadə limiti ayrıca təsdiqlənməlidir.'],
 grok_supergrok:['Grok AI','Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir.','Giriş formasını və konkret abunəlik səviyyəsini dəqiqləşdirin. Məhsul adı bütün modellərə limitsiz giriş vədi deyil.'],
 duolingo:['Duolingo Super','Dil öyrənmə üçün Duolingo Super abunəlik paketidir.','Aktivləşən Duolingo hesabını və paket müddətini yoxlayın. Öyrənmə irəliləyişinizi saxlayan hesabın seçilməsini operatorla dəqiqləşdirin.'],
 netflix_sexsi:['Netflix Şəxsi yenilənməsi','Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir.','Yenilənmə üçün əvvəlki sifariş və otaq məlumatını dəqiqləşdirin. Yeni otaq satışı ilə mövcud otağın yenilənməsini qarışdırmayın.'],
 linkedin_career:['LinkedIn Career','Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir.','Təqdim ediləcək hesabı və abunəlik səviyyəsini aktivləşdirmədən əvvəl dəqiqləşdirin; iş tapılması və ya müraciət nəticəsi barədə zəmanət verilmir.'],
 elevenlabs_creator:['ElevenLabs Creator','Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir.','Səs yaratma limiti və istifadə hüquqlarını konkret paket üzrə yoxlayın. Kontentdən istifadə qaydaları üçün xidmətin öz şərtlərini də oxuyun.'],
 semrush_premium:['Semrush Premium','Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir.','Giriş formatını, layihə və sorğu limitlərini dəqiqləşdirin. Alətə giriş axtarışda mövqe və ya trafik zəmanəti deyil.'],
 adobe_express:['Adobe Express','Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir.','Aldığınız hesabın Express paketini yoxlayın. Creative Cloud proqramlarının hamısını bu paketə daxil hesab etməyin.'],
 notion_plus:['Notion Plus','Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir.','Dəvət və ya giriş aldıqda düzgün iş sahəsini açın. Komanda hüquqları və əlavə AI imkanları ayrıca təsdiqlənməlidir.'],
 picsart_premium:['Picsart Premium','Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir.','Girişdən sonra hesabın paketini yoxlayın. Əlavə AI kreditləri və cihaz sayı konkret sifarişdə təsdiqlənməlidir.'],
 blink_starter:['Blink Starter','Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir.','Hesab formatını, layihə və istifadə limitlərini dəqiqləşdirin. Domen, əlavə kredit və yayımlama xidməti ayrıca göstərilmədikdə daxil sayılmır.'],
 lightroom_photo:['Lightroom Photo','Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir.','Giriş formasını və uyğun tətbiqi yoxlayın. Bulud yaddaşı və əlavə Adobe proqramlarının daxil olub-olmadığını ayrıca dəqiqləşdirin.'],
 gemini_ai_pro:['Gemini AI Pro','Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir.','Paketə uyğun hesabla daxil olun. Model, region və kredit limitləri konkret sifariş üzrə dəqiqləşdirilməlidir.'],
 google_ai:['Gemini AI Pro + 5 TB yaddaş','Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir.','Google hesabının giriş formatını, yaddaşın tətbiqini və AI paketini dəqiqləşdirin. Bu qeyd başqa Google AI məhsulları ilə eyniləşdirilmir.'],
 epinby_3436:['PUBG Mobile 60 UC — arxiv paket','PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir.','Aktual paket üçün PUBG Mobile məhsul səhifəsinə baxın. Bu arxiv qeydindən ayrıca alış nəzərdə tutulmur.']
};
export const productTopics={
 netflix:['Netflix Şəxsi','Netflix almaq, Netflix Premium Azərbaycan, Netflix hesabı, Netflix qiyməti',
  'Netflix Şəxsi film və serial izləmək üçün ayrılan otaq/profil təklifidir. Bu məhsulu ümumi hesabdan fərqləndirən hissə sifarişinizə aid otaq və PIN məlumatıdır.',
  'Təhvil tamamlandıqda hesab, otaq və PIN məlumatlarını Sifarişlərim bölməsindən açın. Ayrılmış profildən istifadə edin; digər profillərin məlumatlarını dəyişməyin.',
  'Netflix Şəxsi ilə ümumi hesabın fərqi nədir?','Bu səhifə şəxsi otaq/profil üçündür. Ümumi hesab ayrıca məhsuldur. Müddət, giriş qaydası və zəmanət seçilən paketə görə yoxlanmalıdır.'],
 netflix_umumi:['Netflix Ümumi','Netflix ümumi hesab almaq, paylaşılan Netflix hesabı',
  'Netflix Ümumi paylaşılan hesab formatında təqdim edilir. Şəxsi otaq təklifi ilə eyni məhsul deyil; giriş və istifadə qaydalarını ödənişdən əvvəl müqayisə edin.',
  'Hesabı təhvil aldıqdan sonra sifarişdəki giriş təlimatını izləyin. Paylaşılan hesabda parolu və digər istifadəçilərin profillərini icazəsiz dəyişməyin.',
  'Bu paket şəxsi Netflix otağıdırmı?','Xeyr, bu səhifə ümumi hesab üçündür. Şəxsi otaq istəyirsinizsə Netflix Şəxsi məhsuluna baxın.'],
 spotify:['Spotify Premium','Spotify Premium almaq, Spotify Premium Azərbaycan, Spotify qiyməti',
  'Bu Spotify Premium təklifi müştərinin öz hesabında aktivləşdirmə üçündür. Mövcud hesabınızı istifadə etmək istəyirsinizsə seçilən paketin adını və tələb olunan giriş məlumatlarını yoxlayın.',
  'Sifariş formasında tələb edilən e-poçt və Spotify şifrəsini yalnız saytın sifariş pəncərəsində daxil edin. Məlumatların düzgünlüyünü təsdiqləyin və aktivləşdirməni Sifarişlərimdən izləyin.',
  'Yeni Spotify hesabı alıram, yoxsa öz hesabımda aktivləşdirilir?','Bu məhsulun aktiv paketi öz hesabınızda aktivləşdirmə kimi göstərilir. Sifarişdən əvvəl paket adını və formanı yenidən yoxlayın.'],
 zoom:['Zoom Pro','Zoom Pro almaq, Zoom Pro Azərbaycan, Zoom hesabı qiyməti',
  'Zoom Pro onlayn dərs, iş görüşü və toplantılar üçün hesab təklifidir. Müddəti və qiyməti aşağıdakı paket seçimində müqayisə edə bilərsiniz.',
  'Təhvil verilən hesabın e-poçt və şifrəsi ilə Zoom tətbiqinə daxil olun. Zoom təsdiq kodu istəyərsə sifarişinizdəki Telefonla giriş təlimatını izləyin.',
  'Zoom girişdə təsdiq kodu istəsə nə edim?','Sifarişlərim → Təlimat bölməsində Zoom üçün telefonlu bələdçini açın. Yalnız öz hesabınıza gələn ən son koddan istifadə edin.'],
 capcut:['CapCut Pro','CapCut Pro almaq, CapCut Pro Azərbaycan, CapCut qiyməti',
  'CapCut Pro video montajı üçün premium hesab təklifidir. Qısa müddətli və aylıq paketləri eyni səhifədə görüb ümumi qiymətlərini müqayisə edə bilərsiniz.',
  'Seçilən paket üçün verilmiş hesab və giriş üsulunu Sifarişlərimdən açın. Tətbiq versiyası və cihazla bağlı göstərişlər üçün məhsulun Təlimat bölməsinə baxın.',
  'CapCut paketlərinin müddəti harada göstərilir?','Hər seçim sətrində müddət və ümumi qiymət verilir. Qısa paketlə aylıq paketin qiymətini eyni müddət kimi müqayisə etməyin.'],
 chatgpt:['ChatGPT Plus şəxsi hesab','ChatGPT Plus almaq, ChatGPT şəxsi hesab Azərbaycan',
  'Bu səhifə hazır şəxsi ChatGPT Plus hesabı təklifi üçündür. Paylaşılan hesabla qarışdırmamaq üçün məhsul adını və seçilmiş müddəti yoxlayın.',
  'Təhvil məlumatlarını Sifarişlərimdə açın. Giriş və iki mərhələli təsdiq üçün məhsula aid təlimatı izləyin; təsdiq kodunu və gizli açarı açıq söhbətdə paylaşmayın.',
  'ChatGPT-yə giriş təlimatını haradan tapım?','Təhvil verilmiş sifarişin Təlimat düyməsindən telefonla giriş bələdçisini açın. Giriş üsulu sizə verilən hesabın məlumatlarına uyğun olmalıdır.'],
 prime:['Amazon Prime Video','Prime Video almaq, Amazon Prime Video Azərbaycan, Prime Video qiyməti',
  'Amazon Prime Video film və serial izləmək üçün hesab təklifidir. Paket müddətini və qiymətini bu səhifədə seçin; bu məhsulu Amazon alış-veriş xidmətləri ilə eyniləşdirməyin.',
  'Təhvil verilən e-poçt və şifrə ilə Prime Video-ya daxil olun. Keçid açarı təklifi görünərsə məhsulun telefonla giriş təlimatındakı şifrə ilə davam etmə addımına baxın.',
  'Prime Video hesabına telefonla necə daxil olum?','Sifarişlərim → Təlimat bölməsində Prime Video üçün e-poçt, şifrə və lazım olduqda keçid açarı ekranı izah olunur.'],
 hbomax:['HBO Max','HBO Max almaq, HBO Max Azərbaycan, HBO Max hesab qiyməti',
  'HBO Max film və serial izləmək üçün hesab təklifidir. Sifariş üçün mövcud müddəti, qiyməti və paket şərtlərini birlikdə yoxlayın.',
  'Sifariş forması otaq adı və PIN istəyərsə onları düzgün daxil edin. Verilən hesabdan məhsulun istifadə təlimatına uyğun yararlanın; əlavə xidmətin mövcudluğunu paket şərtlərində yoxlayın.',
  'HBO Max üçün otaq adı və PIN tələb olunurmu?','Tələb olunan sahələr seçdiyiniz paket üçün sifariş formasında göstərilir. Onları başqa məhsulun məlumatları ilə qarışdırmayın.'],
 surfshark:['Surfshark VPN','Surfshark VPN almaq, VPN Azərbaycan, Surfshark qiyməti',
  'Surfshark VPN internet bağlantısı üçün VPN hesabı təklifidir. Bu məhsul bağlantının məxfiliyi üçün alətdir; tam anonimlik və ya bütün saytlara giriş zəmanəti kimi təqdim edilmir.',
  'Təhvil verilmiş hesabla uyğun Surfshark tətbiqinə daxil olun. Cihaz, tətbiq və bağlantı qaydalarını sifarişin Təlimat bölməsində yoxlayın.',
  'VPN hər xidmətdə işləyəcəyinə zəmanət verirmi?','Xeyr. Şəbəkə, cihaz və üçüncü tərəf xidmətinin məhdudiyyətləri fərqlənə bilər. Konkret istifadəni ödənişdən əvvəl dəqiqləşdirin.'],
 canva:['Canva Premium','Canva Premium almaq, Canva hesabı Azərbaycan, Canva qiyməti',
  'Canva Premium dizayn və təqdimat hazırlamaq üçün paket təklifidir. Müddət və giriş formatı seçdiyiniz paketə görə fərqlənə bilər.',
  'Aktivləşdirmə üçün forma Gmail ünvanı istəyərsə istifadə etdiyiniz ünvanı düzgün yazın. Təhvil və dəvət qaydasını sifarişinizdəki məlumatdan izləyin.',
  'Canva üçün hansı e-poçtu yazmalıyam?','Sifariş forması Gmail istəyirsə aktiv istifadə etdiyiniz Gmail ünvanını daxil edin. Giriş və aktivləşdirmə qaydası həmin sifarişin təlimatında göstərilir.'],
 pubg_mobile:['PUBG Mobile UC','PUBG Mobile UC almaq, PUBG UC Azərbaycan, UC qiyməti',
  'PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır.',
  'UC yükləməsi üçün seçilən paketin tələb etdiyi Player ID və varsa server/region məlumatını daxil edin. Yoxlama hesab adını təsdiqləyirsə adı da tutuşdurun. Şifrəni oyunçu ID-si əvəzinə yazmayın.',
  'PUBG Mobile UC hansı hesaba yüklənir?','Sifarişdə yazdığınız Player ID-yə. Səhv ID və region fərqli hesaba yönələ bilər; ödənişdən əvvəl təsdiq ekranını diqqətlə yoxlayın.'],
 free_fire:['Free Fire almaz','Free Fire almaz almaq, Free Fire Azərbaycan, almaz qiyməti',
  'Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın.',
  'Free Fire Player ID-ni və paket tələb edirsə digər məlumatları daxil edin. Hesab adı yoxlaması əlçatandırsa nəticəni yoxlayın; adı təsdiqlənməmiş hesabı təsdiqlənmiş kimi qəbul etməyin.',
  'Free Fire almaz paketində region vacibdirmi?','Bəli, paket və hesab uyğunluğu vacibdir. Paket adını, tələb olunan sahələri və təsdiq ekranındakı məlumatları ödənişdən əvvəl yoxlayın.'],
 telegram_premium:['Telegram Premium','Telegram Premium almaq, Telegram Premium Azərbaycan, Telegram qiyməti',
  'Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın.',
  'Telegram istifadəçi adını sifariş formasında tələb olunduğu kimi yazın. Paket adı ilə təsdiq ekranındakı xidmət fərqlənirsə ödəniş etmədən operatora müraciət edin.',
  'Telegram Premium və Stars eynidirmi?','Xeyr. Premium müddətli abunəlikdir, Stars isə ayrıca rəqəmsal vahiddir. Yalnız sifariş təsdiqində uyğun xidmət göstəriləndə davam edin.']
};
export function productSeoCopy(product){
 const extra=extraTopics[product.id];
 const topic=productTopics[product.id]||(extra?[extra[0],extra[0]+' almaq, '+extra[0]+' qiyməti',extra[1],extra[2],extra[0]+' necə təqdim olunur?',extra[2]]:null);
 const name=topic?.[0]||String(product.title||'Rəqəmsal məhsul').trim();
 return {name,queries:topic?.[1]||name+' almaq, '+name+' qiyməti',
  title:name+' almaq | Qiymət və paketlər — MirPanel',
  description:({
   netflix:'Netflix Şəxsi hesab almaq üçün aylıq və uzunmüddətli paketləri müqayisə edin. MirPanel-də AZN qiymətləri, ayrılmış otaq, PIN və təhvil qaydasını yoxlayın.',
   netflix_umumi:'Netflix Ümumi hesab üçün cari AZN qiymətini və paylaşılan giriş şərtlərini yoxlayın. Şəxsi otaq paketindən fərqini öyrənib MirPanel-də sifariş edin.',
   spotify:'Spotify Premium-u öz hesabınızda aktivləşdirmək üçün MirPanel paketinə baxın. AZN qiyməti, tələb olunan e-poçt və giriş məlumatlarını əvvəlcədən yoxlayın.',
   zoom:'Zoom Pro almaq üçün MirPanel-də mövcud müddət və AZN qiymətinə baxın. Hazır hesabın təhvili, telefonla giriş və təsdiq kodu addımları ilə tanış olun.',
   capcut:'CapCut Pro almaq üçün qısa və aylıq paketləri MirPanel-də müqayisə edin. AZN qiymətləri, paket zəmanəti və təhvil sonrası giriş təlimatını yoxlayın.',
   chatgpt:'ChatGPT Plus hazır şəxsi hesab üçün MirPanel-in paket və AZN qiymətinə baxın. Paylaşılan hesabdan fərqi, təhvil və təhlükəsiz giriş qaydalarını oxuyun.',
   prime:'Amazon Prime Video almaq üçün bir və altı aylıq seçimləri müqayisə edin. MirPanel-də AZN qiymətlərini, hesab təhvilini və telefonla girişi yoxlayın.',
   hbomax:'HBO Max hesabı üçün MirPanel-də müddət, AZN qiyməti və paket şərtlərinə baxın. Otaq, PIN və təhvil məlumatlarını ödənişdən əvvəl dəqiqləşdirin.',
   surfshark:'Surfshark VPN almaq üçün MirPanel-də paket müddətini və AZN qiymətini yoxlayın. Hesab təhvili, cihaz uyğunluğu və VPN istifadə məhdudiyyətlərini oxuyun.',
   canva:'Canva Premium almaq üçün MirPanel paketlərini və AZN qiymətlərini müqayisə edin. Aktivləşdirmə e-poçtu, giriş formatı və təhvil qaydası ilə tanış olun.',
   pubg_mobile:'PUBG Mobile UC almaq üçün 60 UC, 325 UC və digər paketləri müqayisə edin. MirPanel-də AZN qiymətlərini, Player ID və region uyğunluğunu yoxlayın.',
   free_fire:'Free Fire almaz almaq üçün MirPanel paketlərini və AZN qiymətlərini yoxlayın. Almaz sayı, bonus, region və Player ID məlumatlarını sifarişdən əvvəl tutuşdurun.',
   telegram_premium:'Telegram Premium paket adlarını, AZN qiymətlərini və faktiki xidmət növünü MirPanel-də yoxlayın. Premium abunəliklə Stars fərqini ödənişdən əvvəl dəqiqləşdirin.'
  })[product.id]||(extra?extra[1]+' MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.':name+' üçün paketləri, AZN qiymətini, tələb olunan məlumatları və təhvil qaydasını MirPanel-də yoxlayın.'),
  intro:topic?.[2]||name+' üçün cari paketləri və onların qiymətlərini bu səhifədə müqayisə edin.',
  usage:topic?.[3]||'Seçilmiş paketin tələb etdiyi məlumatları sifariş formasında yoxlayın.',
  question:topic?.[4]||name+' sifarişinin məlumatlarını haradan açım?',
  answer:topic?.[5]||'Təhvil verilmiş sifarişin məlumatları və təlimatı Sifarişlərim bölməsində göstərilir.'};
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const specificRules={
 youtube:['Aktivləşdirmə öz Google hesabınız üçündür. Yeni hesabın sizə veriləcəyini gözləməyin.','Abunəlik açıldıqda YouTube profilində Premium vəziyyətini yoxlayın. Məhsul hazırda sifarişə bağlıdırsa alternativ sifariş yaratmayın.'],
 zoom:['Təqdim edilən e-poçt və şifrə ilə Zoom tətbiqində “Giriş yapın” seçin.','Təsdiq kodu tələb olunarsa Zoom üçün telefonlu təlimatı izləyin; nümunə kodu yox, öz hesabınıza gələn ən son kodu istifadə edin.','Şifrə dəyişməzdən əvvəl sifarişin cari təhvil qeydlərini yoxlayın və operatorla razılaşdırın.'],
 spotify:['Öz Spotify hesabınıza aktivləşdirmə edilir; e-poçt və Spotify şifrəsini sifariş formasında düzgün yazın.','Təkrar şifrə sahəsi varsa eyni şifrəni yazın. Aktivləşdirmə bitdikdə həmin hesabın Premium vəziyyətini yoxlayın.'],
 netflix:['Təhvil məlumatındakı Netflix hesabına daxil olub sizə ayrılmış otağı/profili və PIN-i seçin.','Başqa müştərinin profilinə keçməyin. Otaqla bağlı dəyişiklikdən əvvəl sifarişinizdəki cari istifadə qaydasını oxuyun.'],
 netflix_umumi:['Bu paylaşılan hesabdır, ayrıca şəxsi otaq paketi deyil.','Yalnız təhvil qeydində göstərilən giriş qaydasını izləyin; digər istifadəçilərin şifrəsini və profillərini dəyişməyin.'],
 capcut:['Paketdə seçdiyiniz müddətə uyğun hazır hesabın giriş məlumatını açın.','Telefonda e-poçt və şifrə ilə giriş üçün CapCut təlimatını izləyin. Paket kompüter girişini dəstəkləyirsə, QR ilə giriş zamanı kodu daxil olduğunuz telefondan oxudun.','7 günlük paketlə aylıq paketin xidmət və zəmanət müddətləri eyni deyil; aşağıdakı paket məlumatını ayrıca yoxlayın.'],
 chatgpt:['Sizə verilən şəxsi hesabın e-poçt və şifrəsi ilə ChatGPT-yə daxil olun.','Əlavə təsdiq tələb olunarsa yalnız sifarişdəki şəxsi təlimatdan istifadə edin. Şifrəni, təsdiq kodunu və 2FA açarını açıq söhbətdə paylaşmayın.'],
 prime:['Amazon Prime Video-ya təqdim olunan e-poçt və şifrə ilə daxil olun, ayrılmış profili seçin.','Keçid açarı təklifi çıxarsa Prime Video təlimatındakı şifrə ilə davam etmə addımını izləyin.','Otaq adı və kodu istənilərsə seçilmiş paket formasını doldurun; başqa məhsulun PIN qaydasını tətbiq etməyin.'],
 hbomax:['Təqdim edilən hesabla HBO Max-a daxil olun və sizə ayrılan otaq/profili seçin.','Sifariş forması otaq adı və dördrəqəmli kod istəyirsə düzgün daxil edin. İstifadə zamanı təhvil qaydalarındakı cihaz məhdudiyyətini yoxlayın.','Tətbiqin cihazınızda və regionunuzda açılmasını alışdan əvvəl yoxlayın; işləməyən cihaz üçün ümumi giriş vədi verilmir.'],
 surfshark:['Uyğun Surfshark tətbiqini açıb təqdim olunan hesabla daxil olun.','Bağlantını seçdikdən sonra işləməsini yoxlayın. Şəbəkə və üçüncü tərəf məhdudiyyətləri səbəbindən bütün xidmətlərə giriş vədi verilmir.'],
 canva:['Sifarişdə aktiv istifadə etdiyiniz e-poçt/Gmail ünvanını yazın; hazır hesab veriləcəyini fərz etməyin.','Aktivləşdirmə və ya dəvət təhvil edildikdə həmin ünvanla Canva hesabına daxil olub paket vəziyyətini yoxlayın.'],
 pubg_mobile:['Oyundakı Player ID-ni mətn kimi köçürün; başlanğıc sıfırlarını silməyin.','Seçilmiş UC paketini və tələb edilərsə region/serveri yoxlayın. Hesab adı qaytarılarsa öz hesabınızla tutuşdurun.','Yükləmə nəticəsi təsdiqləndikdən sonra oyunda UC balansını yoxlayın. Oyun şifrəsini Player ID xanasına yazmayın.'],
 free_fire:['Free Fire Player ID-ni öz oyun profilinizdən köçürün və almaz paketini seçin.','Paketin regionu və hesab uyğunluğu vacibdir. Oyunçu adı yoxlanılıbsa adı təsdiqdən əvvəl tutuşdurun.','İcra tamamlandıqdan sonra oyun balansını yoxlayın; yanlış nəticədə sifariş nömrəsi ilə dəstəyə yazın.'],
 telegram_premium:['Diqqət: paket adları Premium göstərsə də təchizatçı bağlantısı hazırda TELEGRAM_STARS kimi saxlanılıb.','Premium abunəlik və Stars fərqli məhsullardır. Xidmət uyğunluğu operator tərəfindən düzəldilmədən bu səhifədən Premium alışı etməyin.'],
 mirpanel_token:['Seçdiyiniz token sayını və yekun məbləği təsdiq edin. Tokenlər başqa platformanın hesab məlumatı deyil.','Ödənişdən sonra hesabınızdakı token vəziyyətini yoxlayın. Uyğunsuzluqda əməliyyatı təkrar ödəmədən sifariş nömrəsi ilə dəstəyə müraciət edin.']
};
export function productCustomerContent(product){
 const copy=productSeoCopy(product),plans=(product.plans||[]).filter(p=>p.active!==false);
 const fields=[...new Set([...(product.formFields||[]),...plans.flatMap(p=>p.formFields||p.supplier?.fields||[])].filter(f=>f.enabled!==false&&f.active!==false).map(f=>f.label).filter(Boolean))];
 const flowFields={name_code_4:['Otaq adı','4 rəqəmli otaq kodu'],name_code_5:['Ad','5 rəqəmli kod']};
 const labels=fields.length?fields:flowFields[product.flow]||[];
 const facts=plans.map(p=>{const m=planMetrics(p);return '<li><strong>'+esc(planName(p))+'</strong> — '+esc(Number(p.price).toFixed(2).replace('.',','))+' '+esc(product.currency||'₼')+(m.warranty?'; '+esc(m.warranty):'')+'.</li>';}).join('');
 const aboutHtml='<h3>Nə əldə edirsiniz?</h3><p>'+esc(copy.intro)+'</p><h3>Paketlərin fərqi</h3><ul>'+facts+'</ul><p>'+esc(labels.length?'Sifariş üçün tələb olunan məlumatlar: '+labels.join(', ')+'.':'Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.')+'</p>';
 const steps=specificRules[product.id]||[copy.usage,'Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.'];
 const rulesHtml='<h3>'+esc(copy.name)+' — istifadə addımları</h3><ol>'+steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><h3>Müddət və zəmanət</h3><ul>'+facts+'</ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href="/profil?tab=sifarislerim">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href="/elaqe">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>';
 return {aboutHtml,rulesHtml};
}
