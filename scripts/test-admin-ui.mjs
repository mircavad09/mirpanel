import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../mirpanel-admin/public/admin.html");
const admin = read("../mirpanel-admin/public/admin.js");
const cms = read("../mirpanel-admin/public/cms-admin.js");
const css = read("../mirpanel-admin/public/admin.css");
const server = read("../mirpanel-admin/server.mjs");
const source = [html, admin, cms, css].join("\n");

assert.match(html, /<meta charset="utf-8">/i, "Admin HTML UTF-8 charset yoxdur");
assert.match(server, /application\/json; charset=utf-8/, "API UTF-8 Content-Type vermir");
assert.equal(/É™|Æ|Ä±|ÅŸ|Åž|Ã¶|Ã¼|Ã§|ÄŸ|â‚¼/.test(admin), false, "Admin mənbəyində mojibake qalıb");
for (const character of [..."əƏıİöÖüÜşŞçÇğĞ₼"]) assert.ok(source.includes(character), `${character} UTF-8 simvolu admin mənbəyində yoxdur`);

assert.ok(cms.includes('"Əsas idarəetmə"') && cms.includes('"Saytın görünüşü"') && cms.includes('"Parametrlər"'), "Sadə naviqasiya qrupları yoxdur");
assert.equal(cms.includes('["footer", "Footer"]'), false, "Ayrıca Footer menyusu qalıb");
assert.equal(cms.includes('["publish", "Önizləmə və yayımlama"]'), false, "Ayrıca publish menyusu qalıb");
assert.ok(cms.includes('showHeader') && cms.includes('showFooter'), "Vahid header/footer keçid seçimləri yoxdur");
assert.ok(cms.includes('showPublishDialog') && cms.includes('changedSections'), "Yuxarıdakı vahid publish yoxlaması yoxdur");
assert.ok(cms.includes('beforeunload'), "Yadda saxlanmamış dəyişiklik xəbərdarlığı yoxdur");

assert.ok(cms.includes('Şəkil kitabxanası') && cms.includes('data-rename-media') && cms.includes('data-replace-media') && cms.includes('data-delete-media'), "Şəkil kitabxanası əməliyyatları natamamdır");
assert.ok(cms.includes('usageCount > 0'), "İstifadədə olan şəkil silinmədən qorunmur");
assert.ok(cms.includes('bannerManageList') && cms.includes('data-edit-product-banner'), "Sadə banner siyahısı yoxdur");
assert.equal(cms.includes('Başlıq<input data-product-banner'), false, "Banner başlığı əsas redaktorda təkrar göstərilir");

assert.ok(cms.includes('Əsas məlumatlar') && cms.includes('Qiymət və planlar') && cms.includes('Sifariş və müştəri forması') && cms.includes('Geniş parametrlər'), "Məhsul forması aydın qruplara bölünməyib");
assert.ok(html.includes('Stok sayını saytda göstər') && html.includes('Google məhsul strukturunda satıcı adı'), "Məhsul sahələrinin izahları yoxdur");
assert.ok(admin.includes('Sifariş təsdiqi → WhatsApp') && admin.includes('Sifariş təsdiqi → Müştəri forması → WhatsApp'), "Sifariş addımları insan dilində deyil");
assert.ok(admin.includes('Minimum uzunluq') && admin.includes('Maksimum uzunluq') && admin.includes('Canlı önizləmə'), "Müştəri forması editoru natamamdır");
assert.ok(css.includes('@media (max-width: 420px)') && css.includes('.customerFormPreview'), "Mobil admin və forma önizləmə stilləri yoxdur");

console.log("PASS: sadələşdirilmiş admin naviqasiyası, məhsul forması, media, banner, publish və UTF-8 UI yoxlamaları.");
