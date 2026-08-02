import fs from "node:fs";

const target = new URL("../mirpanel-admin/public/admin.js", import.meta.url);
const coreTarget = new URL("../mirpanel-admin/core.mjs", import.meta.url);
const replacements = new Map([
  ["É™", "ə"], ["Æ", "Ə"], ["Ä±", "ı"], ["Ä°", "İ"],
  ["Ã¶", "ö"], ["Ã–", "Ö"], ["Ã¼", "ü"], ["Ãœ", "Ü"],
  ["ÅŸ", "ş"], ["Åž", "Ş"], ["Ã§", "ç"], ["Ã‡", "Ç"],
  ["ÄŸ", "ğ"], ["Äž", "Ğ"], ["â‚¼", "₼"]
]);
const brokenPattern = /É™|Æ|Ä±|Ä°|Ã¶|Ã–|Ã¼|Ãœ|ÅŸ|Åž|Ã§|Ã‡|ÄŸ|Äž|â‚¼/g;
const coreReplacements = new Map([
  ["Й™", "ə"], ["ЖЏ", "Ə"], ["Д±", "ı"], ["Д°", "İ"],
  ["Г¶", "ö"], ["Г–", "Ö"], ["Гј", "ü"], ["Гњ", "Ü"],
  ["Еџ", "ş"], ["Ећ", "Ş"], ["Г§", "ç"], ["Г‡", "Ç"],
  ["Дџ", "ğ"], ["Дћ", "Ğ"], ["в‚ј", "₼"]
]);
const coreBrokenPattern = /Й™|ЖЏ|Д±|Д°|Г¶|Г–|Гј|Гњ|Еџ|Ећ|Г§|Г‡|Дџ|Дћ|в‚ј/g;

const original = fs.readFileSync(target, "utf8");
const repaired = [...replacements].reduce(
  (text, [broken, correct]) => text.split(broken).join(correct),
  original
).replace(/\r\n/g, "\n");
const coreOriginal = fs.readFileSync(coreTarget, "utf8");
const coreLines = coreOriginal.split(/\r?\n/);
const coreRepaired = coreLines.map((line, index) => index < 100 ? line : [...coreReplacements].reduce(
  (text, [broken, correct]) => text.split(broken).join(correct),
  line
)).join("\n");

if (process.argv.includes("--check")) {
  if (brokenPattern.test(original) || coreBrokenPattern.test(coreLines.slice(100).join("\n"))) {
    console.error("FAIL: admin.js daxilində pozulmuş UTF-8 mətnləri qalıb.");
    process.exit(1);
  }
  console.log("PASS: admin.js Azərbaycan mətnləri düzgün UTF-8-dir.");
} else if (repaired !== original) {
  fs.writeFileSync(target, repaired, "utf8");
  if (coreRepaired !== coreOriginal) fs.writeFileSync(coreTarget, coreRepaired, "utf8");
  console.log("PASS: admin.js mətnləri düzgün UTF-8-ə çevrildi.");
} else {
  if (coreRepaired !== coreOriginal) fs.writeFileSync(coreTarget, coreRepaired, "utf8");
  console.log("PASS: admin.js artıq düzgün UTF-8-dir.");
}
