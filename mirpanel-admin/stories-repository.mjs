import crypto from "node:crypto";

const IMAGE_LIMIT = 5 * 1024 * 1024;
const VIDEO_LIMIT = 1024 * 1024 * 1024;
const DIRECT_UPLOAD_TTL = 2 * 60 * 60 * 1000;

function cleanText(value, limit = 160) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit);
}

function storageError(error, fallback) {
  if (!error) return;
  throw Object.assign(new Error(error.message || fallback), { status: 502, code: "STORY_STORAGE_ERROR" });
}

function dbError(error, fallback) {
  if (!error) return;
  throw Object.assign(new Error(error.message || fallback), { status: 500, code: "STORY_DATABASE_ERROR" });
}

export function detectStoryMedia(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.length >= 16 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) return { kind: "image", extension: "jpg", mimeType: "image/jpeg", limit: IMAGE_LIMIT };
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.includes(Buffer.from("IEND"))) return { kind: "image", extension: "png", mimeType: "image/png", limit: IMAGE_LIMIT };
  if (buffer.length >= 20 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" && buffer.readUInt32LE(4) + 8 <= buffer.length) return { kind: "image", extension: "webp", mimeType: "image/webp", limit: IMAGE_LIMIT };
  if (buffer.length >= 20 && buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.readUInt32BE(0) >= 16 && buffer.readUInt32BE(0) <= buffer.length) return { kind: "video", extension: "mp4", mimeType: "video/mp4", limit: VIDEO_LIMIT };
  if (buffer.length >= 16 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: "video", extension: "webm", mimeType: "video/webm", limit: VIDEO_LIMIT };
  return null;
}

export function detectStoryVideoPrefix(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.readUInt32BE(0) >= 16) return { kind: "video", extension: "mp4", mimeType: "video/mp4", limit: VIDEO_LIMIT };
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: "video", extension: "webm", mimeType: "video/webm", limit: VIDEO_LIMIT };
  return null;
}

export function decodeStoryUpload(upload, expectedKind) {
  if (!upload?.contentBase64) throw Object.assign(new Error("Media faylı seçilməyib."), { status: 400, code: "STORY_FILE_REQUIRED" });
  const encoded = String(upload.contentBase64).replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  const buffer = Buffer.from(encoded, "base64");
  const detected = detectStoryMedia(buffer);
  if (!detected || detected.kind !== expectedKind) {
    const message = expectedKind === "image" ? "Yalnız JPG, PNG və WEBP şəkli qəbul edilir." : "Yalnız MP4 və WEBM videosu qəbul edilir.";
    throw Object.assign(new Error(message), { status: 400, code: "STORY_FILE_UNSUPPORTED" });
  }
  if (buffer.length > detected.limit) {
    const message = detected.kind === "image" ? "Şəkil maksimum 5 MB ola bilər." : "Video maksimum 1 GB ola bilər.";
    throw Object.assign(new Error(message), { status: 413, code: "STORY_FILE_TOO_LARGE" });
  }
  return { ...detected, buffer };
}

export function createStoriesRepository(client, { bucket = "mirpanel-stories", signedUrlSeconds = 3600, inspectDirectObject = null } = {}) {
  const categories = () => client.from("story_categories");
  const items = () => client.from("story_items");
  const pendingUploads = new Map();

  function directUploadError(message, status = 400, code = "STORY_DIRECT_UPLOAD_INVALID") {
    return Object.assign(new Error(message), { status, code });
  }

  async function storyExists(storyId) {
    const { data, error } = await categories().select("id").eq("id", storyId).single();
    dbError(error, "Story tapılmadı.");
    return Boolean(data);
  }

  async function beginVideoUpload(storyId, payload = {}) {
    await storyExists(storyId);
    const size = Number(payload.size);
    if (!Number.isSafeInteger(size) || size <= 0) throw directUploadError("Video faylının ölçüsü düzgün deyil.");
    if (size > VIDEO_LIMIT) throw directUploadError("Video maksimum 1 GB ola bilər.", 413, "STORY_FILE_TOO_LARGE");
    const mimeType = String(payload.mimeType || "").toLowerCase();
    const fileName = String(payload.fileName || "").toLowerCase();
    const extension = mimeType === "video/webm" || fileName.endsWith(".webm") ? "webm" : mimeType === "video/mp4" || fileName.endsWith(".mp4") ? "mp4" : "";
    if (!extension) throw directUploadError("Yalnız MP4 və WEBM videosu qəbul edilir.", 400, "STORY_FILE_UNSUPPORTED");
    const operationId = crypto.randomUUID();
    const path = `items/${storyId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
    const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    storageError(error, "Video üçün təhlükəsiz upload keçidi hazırlanmadı.");
    const cleanupTimer = setTimeout(async () => {
      const expired = pendingUploads.get(operationId);
      if (!expired) return;
      pendingUploads.delete(operationId);
      await client.storage.from(bucket).remove([expired.path]).catch(() => {});
    }, DIRECT_UPLOAD_TTL);
    cleanupTimer.unref?.();
    pendingUploads.set(operationId, { storyId, path, size, extension, mimeType: `video/${extension === "mp4" ? "mp4" : "webm"}`, expiresAt: Date.now() + DIRECT_UPLOAD_TTL, busy: false, cleanupTimer });
    return { operationId, path, signedUrl: data?.signedUrl, token: data?.token, expiresIn: DIRECT_UPLOAD_TTL / 1000 };
  }

  async function inspectUploadedVideo(pending) {
    if (inspectDirectObject) return inspectDirectObject(pending);
    const slash = pending.path.lastIndexOf("/");
    const folder = pending.path.slice(0, slash);
    const name = pending.path.slice(slash + 1);
    const { data: listed, error: listError } = await client.storage.from(bucket).list(folder, { search: name, limit: 10 });
    storageError(listError, "Yüklənmiş video yoxlanmadı.");
    const object = (listed || []).find((entry) => entry.name === name);
    const storedSize = Number(object?.metadata?.size ?? object?.metadata?.contentLength ?? object?.metadata?.content_length);
    if (!object || storedSize !== pending.size || storedSize > VIDEO_LIMIT) throw directUploadError("Video private storage-a tam yazılmayıb.", 409, "STORY_UPLOAD_INCOMPLETE");
    const { data: signedData, error: signedError } = await client.storage.from(bucket).createSignedUrl(pending.path, 60);
    storageError(signedError, "Video yoxlama keçidi hazırlanmadı.");
    const response = await fetch(signedData.signedUrl, { headers: { Range: "bytes=0-63" } });
    if (!response.ok) throw directUploadError("Yüklənmiş video oxunmadı.", 502, "STORY_STORAGE_ERROR");
    const reader = response.body?.getReader();
    const first = reader ? await reader.read() : { value: new Uint8Array(await response.arrayBuffer()) };
    await reader?.cancel();
    const detected = detectStoryVideoPrefix(Buffer.from(first.value || []));
    if (!detected || detected.extension !== pending.extension) throw directUploadError("Yalnız etibarlı MP4 və WEBM videosu qəbul edilir.", 400, "STORY_FILE_UNSUPPORTED");
    return { path: pending.path, kind: "video" };
  }

  async function cancelVideoUpload(operationId) {
    const pending = pendingUploads.get(operationId);
    if (!pending) return;
    pendingUploads.delete(operationId);
    clearTimeout(pending.cleanupTimer);
    await client.storage.from(bucket).remove([pending.path]);
  }

  async function consumeVideoUpload(operationId, storyId) {
    const pending = pendingUploads.get(String(operationId || ""));
    if (!pending || pending.expiresAt <= Date.now() || pending.storyId !== storyId || pending.busy) throw directUploadError("Video upload əməliyyatı etibarsızdır və ya artıq istifadə olunub.", 409);
    pending.busy = true;
    try {
      const result = await inspectUploadedVideo(pending);
      pendingUploads.delete(operationId);
      clearTimeout(pending.cleanupTimer);
      return result;
    } catch (error) {
      pendingUploads.delete(operationId);
      clearTimeout(pending.cleanupTimer);
      await client.storage.from(bucket).remove([pending.path]).catch(() => {});
      throw error;
    }
  }

  async function signed(path) {
    if (!path) return "";
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, signedUrlSeconds);
    storageError(error, "Story media keçidi hazırlanmadı.");
    return data?.signedUrl || "";
  }

  async function attachUrls(rows, includeInactive = false) {
    const visible = includeInactive ? rows : rows.filter((row) => row.active !== false);
    return Promise.all(visible.map(async (story) => ({
      ...story,
      coverUrl: await signed(story.cover_path),
      items: await Promise.all((story.items || [])
        .filter((item) => includeInactive || item.active !== false)
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
        .map(async (item) => ({ ...item, mediaUrl: await signed(item.media_path) })))
    })));
  }

  async function list(includeInactive = false) {
    let categoryQuery = categories().select("id,title,cover_path,sort_order,active,created_at,updated_at").order("sort_order").order("created_at");
    let itemQuery = items().select("id,story_id,media_type,media_path,caption,sort_order,active,created_at,updated_at").order("sort_order").order("created_at");
    if (!includeInactive) {
      categoryQuery = categoryQuery.eq("active", true);
      itemQuery = itemQuery.eq("active", true);
    }
    const [{ data: storyRows, error: storyError }, { data: itemRows, error: itemError }] = await Promise.all([categoryQuery, itemQuery]);
    dbError(storyError, "Stories siyahısı oxunmadı.");
    dbError(itemError, "Story elementləri oxunmadı.");
    const grouped = new Map((storyRows || []).map((story) => [story.id, { ...story, items: [] }]));
    for (const item of itemRows || []) grouped.get(item.story_id)?.items.push(item);
    return attachUrls([...grouped.values()].filter((story) => includeInactive || story.items.length), includeInactive);
  }

  async function uploadFile(upload, expectedKind, prefix) {
    const file = decodeStoryUpload(upload, expectedKind);
    const path = `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${file.extension}`;
    const { error } = await client.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimeType, upsert: false, cacheControl: "3600" });
    storageError(error, "Story media private storage-a yazılmadı.");
    return { path, kind: file.kind };
  }

  async function removePathsIfUnused(paths) {
    const candidates = [...new Set(paths.filter(Boolean))];
    if (!candidates.length) return;
    const [{ data: coverRefs, error: coverError }, { data: itemRefs, error: itemError }] = await Promise.all([
      categories().select("cover_path").in("cover_path", candidates),
      items().select("media_path").in("media_path", candidates)
    ]);
    dbError(coverError, "Story cover əlaqələri yoxlanmadı.");
    dbError(itemError, "Story media əlaqələri yoxlanmadı.");
    const used = new Set([...(coverRefs || []).map((row) => row.cover_path), ...(itemRefs || []).map((row) => row.media_path)]);
    const removable = candidates.filter((path) => !used.has(path));
    if (!removable.length) return;
    const { error } = await client.storage.from(bucket).remove(removable);
    storageError(error, "İstifadəsiz story media faylı silinmədi.");
  }

  async function createStory(payload) {
    const title = cleanText(payload.title, 80);
    if (!title) throw Object.assign(new Error("Story başlığı tələb olunur."), { status: 400 });
    const cover = await uploadFile(payload.cover, "image", "covers");
    const { data, error } = await categories().insert({ title, cover_path: cover.path, sort_order: Math.max(1, Number(payload.sortOrder) || 1), active: payload.active !== false }).select().single();
    if (error) { await client.storage.from(bucket).remove([cover.path]); dbError(error, "Story yaradılmadı."); }
    return data;
  }

  async function updateStory(id, payload) {
    const { data: current, error: currentError } = await categories().select("*").eq("id", id).single();
    dbError(currentError, "Story tapılmadı.");
    let uploaded = null;
    if (payload.cover?.contentBase64) uploaded = await uploadFile(payload.cover, "image", "covers");
    const changes = {
      title: cleanText(payload.title ?? current.title, 80),
      sort_order: Math.max(1, Number(payload.sortOrder ?? current.sort_order) || 1),
      active: payload.active ?? current.active,
      ...(uploaded ? { cover_path: uploaded.path } : {})
    };
    const { data, error } = await categories().update(changes).eq("id", id).select().single();
    if (error) { if (uploaded) await client.storage.from(bucket).remove([uploaded.path]); dbError(error, "Story yenilənmədi."); }
    if (uploaded) await removePathsIfUnused([current.cover_path]);
    return data;
  }

  async function deleteStory(id) {
    const { data: story, error: storyError } = await categories().select("cover_path").eq("id", id).single();
    dbError(storyError, "Story tapılmadı.");
    const { data: storyItems, error: itemError } = await items().select("media_path").eq("story_id", id);
    dbError(itemError, "Story elementləri oxunmadı.");
    const { error } = await categories().delete().eq("id", id);
    dbError(error, "Story silinmədi.");
    await removePathsIfUnused([story.cover_path, ...(storyItems || []).map((item) => item.media_path)]);
  }

  async function createItem(storyId, payload) {
    const requestedKind = payload.mediaType === "video" ? "video" : "image";
    const upload = requestedKind === "video" && payload.directUploadId
      ? await consumeVideoUpload(payload.directUploadId, storyId)
      : await uploadFile(payload.media, requestedKind, `items/${storyId}`);
    const { data, error } = await items().insert({ story_id: storyId, media_type: upload.kind, media_path: upload.path, caption: cleanText(payload.caption, 240), sort_order: Math.max(1, Number(payload.sortOrder) || 1), active: payload.active !== false }).select().single();
    if (error) { await client.storage.from(bucket).remove([upload.path]); dbError(error, "Story elementi yaradılmadı."); }
    return data;
  }

  async function updateItem(id, payload) {
    const { data: current, error: currentError } = await items().select("*").eq("id", id).single();
    dbError(currentError, "Story elementi tapılmadı.");
    let uploaded = null;
    if (payload.directUploadId) uploaded = await consumeVideoUpload(payload.directUploadId, current.story_id);
    else if (payload.media?.contentBase64) uploaded = await uploadFile(payload.media, payload.mediaType === "video" ? "video" : "image", `items/${current.story_id}`);
    const { data, error } = await items().update({
      caption: cleanText(payload.caption ?? current.caption, 240),
      sort_order: Math.max(1, Number(payload.sortOrder ?? current.sort_order) || 1),
      active: payload.active ?? current.active,
      ...(uploaded ? { media_type: uploaded.kind, media_path: uploaded.path } : {})
    }).eq("id", id).select().single();
    if (error) { if (uploaded) await client.storage.from(bucket).remove([uploaded.path]); dbError(error, "Story elementi yenilənmədi."); }
    if (uploaded) await removePathsIfUnused([current.media_path]);
    return data;
  }

  async function deleteItem(id) {
    const { data: current, error: currentError } = await items().select("media_path").eq("id", id).single();
    dbError(currentError, "Story elementi tapılmadı.");
    const { error } = await items().delete().eq("id", id);
    dbError(error, "Story elementi silinmədi.");
    await removePathsIfUnused([current.media_path]);
  }

  return { listPublic: () => list(false), listAdmin: () => list(true), createStory, updateStory, deleteStory, createItem, updateItem, deleteItem, beginVideoUpload, cancelVideoUpload };
}

export const STORY_LIMITS = { imageBytes: IMAGE_LIMIT, videoBytes: VIDEO_LIMIT };
