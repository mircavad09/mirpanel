// Regression contract for the real server routing omitted by former UI fixtures.
import fs from 'node:fs';import assert from 'node:assert/strict';
const server=fs.readFileSync('mirpanel-admin/server.mjs','utf8'),html=fs.readFileSync('mirpanel-admin/public/admin.html','utf8');
assert.match(html,/src="\/admin-private-support\.js\?/);
assert.match(server,/if\(\['\/admin-private-support\.js',[\s\S]*?\.includes\(pathname\)\)\{\s*if\(!requireAuth\(request,response\)\)return;\s*if\(getSession\(request\)\?\.role!=='admin'\)return json\(response,403,[\s\S]*?return serveFile\(response,pathname\.slice\(1\)\);/);
assert(fs.existsSync('mirpanel-admin/public/admin-private-support.js'));
console.log('PASS real admin HTML entry is routed through existing session + admin authorization; file exists. Live normal-login HTTP and browser roundtrip still required.');
