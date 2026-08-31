import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { generateNetflixConfirmationPageFiles } from "../mirpanel-admin/product-pages.mjs";

test("Netflix confirmation page contains only the safe form surface", async () => {
  const page = generateNetflixConfirmationPageFiles().get("netflix_tesdiq/index.html");
  assert.match(page, /<h1 id="netflixConfirmationTitle">Netflix Təsdiqi<\/h1>/);
  assert.match(page, /Sizə verilmiş Gmail ünvanını daxil edin\./);
  assert.match(page, /id="netflixConfirmationEmail"/);
  assert.match(page, />Təsdiqi al<\/button>/);
  assert.match(page, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(page, /netflix-confirmation\.js\?v=20260901-1/);
});

test("confirmation browser code POSTs only and keeps email out of persistent storage", async () => {
  const source = await fs.readFile(new URL("../netflix-confirmation.js", import.meta.url), "utf8");
  assert.match(source, /https:\/\/mirpanel\.onrender\.com\/api\/netflix\/confirmation/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /referrerPolicy: "no-referrer"/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.|location\.|history\.|href\s*=/);
});
