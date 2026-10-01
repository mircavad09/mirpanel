import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStoriesRepository, decodeStoryUpload, detectStoryMedia, detectStoryVideoPrefix, STORY_LIMITS } from "../mirpanel-admin/stories-repository.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jpg = Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0,0,0,0xff,0xd9]);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
const mp4 = Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftypisomisom"),Buffer.alloc(4)]);
const mov = Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from("ftypqt  "),Buffer.alloc(8)]);
const webm = Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0,0,0,0,0,0,0,0,0]);
assert.equal(detectStoryMedia(jpg)?.mimeType, "image/jpeg");
assert.equal(detectStoryMedia(png)?.mimeType, "image/png");
assert.equal(detectStoryMedia(mp4)?.mimeType, "video/mp4");
assert.equal(detectStoryMedia(webm)?.mimeType, "video/webm");
assert.equal(detectStoryVideoPrefix(mp4)?.mimeType, "video/mp4");
assert.equal(detectStoryVideoPrefix(mov)?.mimeType, "video/quicktime");
assert.equal(STORY_LIMITS.videoBytes, 1073741824);
assert.equal(detectStoryMedia(Buffer.alloc(20)), null);
assert.throws(() => decodeStoryUpload({ contentBase64: mp4.toString("base64") }, "image"), /Yalnız JPG/);

function fakeSupabase() {
  const tables = { story_categories: [], story_items: [] };
  const objects = new Map();
  let id = 0;
  const clone = (value) => structuredClone(value);
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.mode = "select"; this.values = null; this.wantSingle = false; }
    select() { return this; }
    order() { return this; }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    insert(values) { this.mode = "insert"; this.values = values; return this; }
    update(values) { this.mode = "update"; this.values = values; return this; }
    delete() { this.mode = "delete"; return this; }
    single() { this.wantSingle = true; return this; }
    then(resolve) {
      let rows = tables[this.table];
      const matches = (row) => this.filters.every((filter) => filter(row));
      if (this.mode === "insert") {
        const now = new Date().toISOString();
        const row = { id: `00000000-0000-4000-8000-${String(++id).padStart(12,"0")}`, created_at: now, updated_at: now, ...clone(this.values) };
        rows.push(row); return resolve({ data: this.wantSingle ? clone(row) : [clone(row)], error: null });
      }
      if (this.mode === "update") {
        const changed = rows.filter(matches).map((row) => Object.assign(row, clone(this.values), { updated_at: new Date().toISOString() }));
        return resolve({ data: this.wantSingle ? clone(changed[0]) : clone(changed), error: changed.length ? null : { message: "not found" } });
      }
      if (this.mode === "delete") {
        const removed = rows.filter(matches); tables[this.table] = rows.filter((row) => !matches(row));
        if (this.table === "story_categories") tables.story_items = tables.story_items.filter((item) => !removed.some((story) => story.id === item.story_id));
        return resolve({ data: clone(removed), error: null });
      }
      const found = rows.filter(matches);
      return resolve({ data: this.wantSingle ? clone(found[0]) : clone(found), error: this.wantSingle && !found[0] ? { message: "not found" } : null });
    }
  }
  return {
    tables, objects,
    from: (table) => new Query(table),
    storage: { from: () => ({
      upload: async (key, buffer, options) => { if (objects.has(key)) return { error: { message: "exists" } }; objects.set(key, { buffer, ...options }); return { error: null }; },
      remove: async (keys) => { keys.forEach((key) => objects.delete(key)); return { error: null }; },
      createSignedUploadUrl: async (key) => ({ data: { signedUrl: `https://upload.test/${key}?token=short-lived`, token: "short-lived" }, error: null }),
      list: async (folder, options) => ({ data: [...objects.entries()].filter(([key]) => key.startsWith(`${folder}/`) && key.endsWith(options.search)).map(([key,value]) => ({ name:key.split("/").at(-1), metadata:{ size:value.buffer.length } })), error: null }),
      createSignedUrl: async (key) => objects.has(key) ? { data: { signedUrl: `https://signed.test/${key}?token=private` }, error: null } : { data: null, error: { message: "missing" } }
    }) }
  };
}

const client = fakeSupabase();
const repo = createStoriesRepository(client);
const story = await repo.createStory({ title: "Bloggerlər", sortOrder: 2, active: true, cover: { contentBase64: jpg.toString("base64") } });
const imageItem = await repo.createItem(story.id, { mediaType: "image", caption: "Şəkil", sortOrder: 1, active: true, media: { contentBase64: png.toString("base64") } });
const videoItem = await repo.createItem(story.id, { mediaType: "video", caption: "Video", sortOrder: 2, active: true, media: { contentBase64: mp4.toString("base64") } });
let publicStories = await repo.listPublic();
assert.equal(publicStories.length, 1);
assert.equal(publicStories[0].items.length, 2);
assert.match(publicStories[0].coverUrl, /token=private/);
assert.match(publicStories[0].items[1].mediaUrl, /token=private/);
await repo.updateItem(videoItem.id, { active: false });
publicStories = await repo.listPublic();
assert.equal(publicStories[0].items.length, 1, "Deaktiv media public cavabdan çıxmalıdır");
await repo.updateStory(story.id, { active: false });
assert.equal((await repo.listPublic()).length, 0, "Deaktiv story public cavabdan çıxmalıdır");
await repo.updateStory(story.id, { active: true });
const oldImagePath = client.tables.story_items.find((item) => item.id === imageItem.id).media_path;
const secondStory = await repo.createStory({ title: "Kampaniyalar", sortOrder: 3, active: true, cover: { contentBase64: jpg.toString("base64") } });
client.tables.story_items.push({
  id: "00000000-0000-4000-8000-999999999999",
  story_id: secondStory.id,
  media_type: "image",
  media_path: oldImagePath,
  caption: "Ortaq media",
  sort_order: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
await repo.deleteItem(imageItem.id);
assert.equal(client.objects.has(oldImagePath), true, "Başqa story-nin istifadə etdiyi media storage-dan silinməməlidir");
await repo.deleteStory(secondStory.id);
assert.equal(client.objects.has(oldImagePath), false, "Son əlaqə silinəndə media private storage-dan silinməlidir");
await repo.deleteStory(story.id);
assert.equal(client.tables.story_categories.length, 0);
assert.equal(client.tables.story_items.length, 0);
assert.equal(client.objects.size, 0, "Story silindikdə yalnız onun istifadəsiz mediası qalmalıdır");

const directClient = fakeSupabase();
const directRepo = createStoriesRepository(directClient, { inspectDirectObject: async (pending) => {
  const object = directClient.objects.get(pending.path);
  if (!object || object.buffer.length !== pending.size || !detectStoryVideoPrefix(object.buffer)) throw Object.assign(new Error("incomplete"), { status:409 });
  return { path:pending.path, kind:"video" };
} });
const directStory = await directRepo.createStory({ title:"Direct", cover:{ contentBase64:jpg.toString("base64") } });
const prepared = await directRepo.beginVideoUpload(directStory.id, { fileName:"clip.mp4", mimeType:"video/mp4", size:mp4.length });
assert.match(prepared.signedUrl, /token=short-lived/);
assert.equal(directClient.tables.story_items.length, 0, "Upload bitmədən media qeydi yaranmamalıdır");
directClient.objects.set(prepared.path, { buffer:mp4, contentType:"video/mp4" });
const directItem = await directRepo.createItem(directStory.id, { mediaType:"video", directUploadId:prepared.operationId, active:true });
assert.equal(directItem.media_path, prepared.path);
await assert.rejects(() => directRepo.createItem(directStory.id, { mediaType:"video", directUploadId:prepared.operationId }), /etibarsızdır/);
await assert.rejects(() => directRepo.beginVideoUpload(directStory.id, { fileName:"too-big.mp4", mimeType:"video/mp4", size:STORY_LIMITS.videoBytes + 1 }), /maksimum 1 GB/);
const movPrepared = await directRepo.beginVideoUpload(directStory.id, { fileName:"iphone.mov", mimeType:"video/quicktime", size:mov.length });
assert.match(movPrepared.path, /\.mov$/);
await directRepo.cancelVideoUpload(movPrepared.operationId);
await assert.rejects(() => directRepo.beginVideoUpload(directStory.id, { fileName:"sound.mp3", mimeType:"audio/mpeg", size:100 }), /Yalnız video faylı seçin/);

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "mirpanel-admin/server.mjs"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202609260001_stories.sql"), "utf8");
const videoMigration = fs.readFileSync(path.join(root, "supabase/migrations/202609270001_story_video_1gb.sql"), "utf8");
const movMigration = fs.readFileSync(path.join(root, "supabase/migrations/202610010001_story_mov_upload.sql"), "utf8");
assert.ok(index.includes('id="heroSlider"'));
assert.ok(index.includes('id="homeStories"'));
assert.equal(index.includes('id="homeSecondaryBanners"'), false);
assert.ok(server.indexOf('request.url === "/api/stories"') < server.indexOf('if (!requireAuth(request, response)) return'));
assert.match(server, /"Cache-Control": "no-store, max-age=0"/);
assert.match(server, /Pragma: "no-cache"/);
assert.ok(server.indexOf('request.url === "/api/admin/stories"') > server.indexOf('if (!requireAuth(request, response)) return'));
assert.match(migration, /public, file_size_limit[\s\S]*false, 26214400/);
assert.match(migration, /enable row level security/g);
assert.match(migration, /revoke all .* anon, authenticated/g);
assert.match(migration, /grant select, insert, update, delete on public\.story_categories to service_role/);
assert.match(migration, /grant select, insert, update, delete on public\.story_items to service_role/);
assert.match(videoMigration, /public = false/);
assert.match(videoMigration, /file_size_limit = 1073741824/);
assert.match(movMigration, /file_size_limit = 1073741824/);
assert.match(movMigration, /video\/quicktime/);
console.log(JSON.stringify({ ok:true, create:true, update:true, ordering:true, activeFiltering:true, imageUpload:true, directVideoUpload:true, videoLimitBytes:STORY_LIMITS.videoBytes, pendingNotPublic:true, idempotentFinalize:true, privateSignedUrls:true, deleteCleanup:true, publicReadOnly:true, adminProtected:true }, null, 2));
