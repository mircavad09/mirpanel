import assert from 'node:assert/strict';import fs from 'node:fs';
import {generateRedirects} from '../mirpanel-admin/product-pages.mjs';
const redirects=fs.readFileSync('_redirects','utf8');
assert.equal(/^\/sifarislerim\s+\/sifarislerim\.html\s+200\s*$/m.test(redirects),false,'Cloudflare clean-URL redirect must not be fed by a self-rewriting HTML rule');
assert.equal(fs.existsSync('sifarislerim.html'),true,'Native extensionless asset resolution requires the HTML asset');
assert.match(redirects,/^\/sifarislerim\/\s+\/sifarislerim\s+301\s*$/m);
assert.match(generateRedirects(),/^\/sifarislerim\/\s+\/sifarislerim\s+301\s*$/m,'Admin regeneration must preserve history route');
assert.equal(/^\/sifarislerim\s+\/sifarislerim\.html\s+200\s*$/m.test(generateRedirects()),false);
console.log(JSON.stringify({ok:true,checks:5,nativeCloudflareCleanUrl:true}));
