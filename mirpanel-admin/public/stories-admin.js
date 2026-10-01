(() => {
  const escs = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const VIDEO_LIMIT_BYTES = 1024 * 1024 * 1024;
  const VIDEO_RETRY_DELAYS = [1500, 3000, 4500];
  const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
  const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
  let snapshot = { stories: [], activeStories: 0, activeItems: 0, limits: { imageMb: 5, videoMb: 1024 } };

  function finalSaveButton(scope) {
    return scope?.querySelector("[data-story-final-save],[data-item-save]");
  }

  function setUnsaved(scope, unsaved = true) {
    if (!scope) return;
    scope.dataset.unsaved = unsaved ? "true" : "false";
    const button = finalSaveButton(scope);
    if (button && unsaved && !scope.dataset.uploading) button.disabled = false;
  }

  function fileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("Fayl oxunmadı."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadPayload(file, kind) {
    if (!file) return null;
    if (kind === "video") throw new Error("Video birbaşa private storage-a yüklənməlidir.");
    const limit = (kind === "video" ? snapshot.limits.videoMb : snapshot.limits.imageMb) * 1024 * 1024;
    if (file.size > limit) throw new Error(`Fayl maksimum ${kind === "video" ? snapshot.limits.videoMb : snapshot.limits.imageMb} MB ola bilər.`);
    return { fileName: file.name, mimeType: file.type, contentBase64: await fileBase64(file) };
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function uploadSignedFile(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const storageOrigin = (() => { try { return new URL(url).origin; } catch { return "invalid"; } })();
      xhr.open("PUT", url, true);
      xhr.timeout = 15 * 60 * 1000;
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        const retryable = [408, 429, 500, 502, 503, 504].includes(xhr.status);
        const code = `STORY_STORAGE_HTTP_${xhr.status}`;
        console.warn("[story-upload] Storage upload rejected", { code, status: xhr.status, origin: storageOrigin, response: String(xhr.responseText || "").slice(0, 300) });
        reject(Object.assign(new Error(retryable ? "Storage müvəqqəti cavab vermədi." : `Storage videonu qəbul etmədi (${xhr.status}).`), { retryable, code, status: xhr.status }));
      });
      xhr.addEventListener("error", () => {
        const code = "STORY_STORAGE_NETWORK";
        console.warn("[story-upload] Storage request failed before an HTTP response", { code, status: xhr.status, readyState: xhr.readyState, origin: storageOrigin, online: navigator.onLine });
        reject(Object.assign(new Error("Storage ilə bağlantı qurulmadı."), { retryable: true, code }));
      });
      xhr.addEventListener("timeout", () => {
        const code = "STORY_STORAGE_TIMEOUT";
        console.warn("[story-upload] Storage upload timed out", { code, origin: storageOrigin, timeoutMs: xhr.timeout });
        reject(Object.assign(new Error("Video yükləmə vaxtı bitdi."), { retryable: true, code }));
      });
      xhr.addEventListener("abort", () => reject(Object.assign(new Error("Video yüklənməsi dayandırıldı."), { retryable: false, code: "STORY_STORAGE_ABORTED" })));
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file, file.name);
      xhr.send(body);
    });
  }

  function videoExtension(file) {
    return String(file?.name || "").toLowerCase().split(".").pop();
  }

  function validateVideoSelection(file) {
    const type = String(file?.type || "").toLowerCase();
    const extension = videoExtension(file);
    if (type.startsWith("audio/") || ["mp3", "wav", "aac", "m4a", "ogg"].includes(extension)) throw new Error("Yalnız video faylı seçin.");
    if (!(VIDEO_MIME_TYPES.has(type) || ((!type || type === "application/octet-stream") && VIDEO_EXTENSIONS.has(extension)))) throw new Error("Yalnız MP4, MOV və WebM video faylı seçin.");
  }

  function showVideoSelection(input, file) {
    const scope = input.closest("form,[data-item-card]");
    const status = scope?.querySelector("[data-upload-status]");
    if (!scope || !status) return;
    scope.querySelector(".storyUploadSelection")?.remove();
    const preview = document.createElement("div"); preview.className = "storyUploadSelection";
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file); video.controls = true; video.muted = true; video.playsInline = true; video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => URL.revokeObjectURL(video.src), { once: true });
    video.addEventListener("error", () => {
      if (!scope.dataset.uploading && !scope.dataset.directUploadId) status.textContent = "Video preview açıla bilmədi. Uyğun MP4, MOV və ya WebM seçin.";
    }, { once: true });
    const text = document.createElement("span"); text.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB · Video seçildi`;
    preview.append(video, text); status.before(preview);
    status.textContent = "Video: MP4, MOV və WebM · maksimum 1 GB";
  }

  async function startVideoUpload(scope, input, file) {
    const button = finalSaveButton(scope);
    const status = scope.querySelector("[data-upload-status]");
    const retryButton = scope.querySelector("[data-upload-retry]");
    if (scope.dataset.uploading === "true") return;
    scope.dataset.uploading = "true";
    delete scope.dataset.directUploadId;
    setUnsaved(scope, true);
    button.disabled = true; retryButton.hidden = true; retryButton.disabled = true;
    try {
      const storyId = scope.dataset.itemCreate || scope.closest("[data-story-card]")?.dataset.storyCard;
      const directUploadId = await directVideoUpload(storyId, file, status);
      scope.dataset.directUploadId = directUploadId;
      status.textContent = "Video yükləndi. Story-ni yadda saxlayın.";
      button.disabled = false;
      button.scrollIntoView({ behavior: "auto", block: "center" });
    } catch (error) {
      status.textContent = navigator.onLine === false ? "İnternet bağlantısı yoxdur. Video seçimi qorunub." : "Video yüklənmədi.";
      retryButton.hidden = false; retryButton.disabled = false;
      toast(error.message || "Video yüklənmədi.", "bad");
    } finally {
      delete scope.dataset.uploading;
    }
  }

  async function handleMediaSelection(event) {
    const input = event.target.closest('input[name="media"],[data-item-file]');
    const file = input?.files?.[0];
    if (!input || !file) return;
    const scope = input.closest("form,[data-item-card]");
    const button = finalSaveButton(scope);
    const status = scope?.querySelector("[data-upload-status]");
    const type = String(file.type || "").toLowerCase(); const extension = videoExtension(file);
    if (type.startsWith("video/") || type.startsWith("audio/") || VIDEO_EXTENSIONS.has(extension) || ["mp3", "wav", "aac", "m4a", "ogg"].includes(extension)) {
      try {
        validateVideoSelection(file);
        const selector = scope?.querySelector('select[name="mediaType"],[data-item-type]');
        if (selector) selector.value = "video";
        showVideoSelection(input, file);
        if (scope.dataset.directUploadId) await api(`/api/admin/story-video-uploads/${scope.dataset.directUploadId}`, { method: "DELETE" }).catch(() => {});
        await startVideoUpload(scope, input, file);
      } catch (error) {
        delete scope.dataset.uploading;
        delete scope.dataset.directUploadId;
        if (/Yalnız (video|MP4)/.test(error.message)) input.value = "";
        button.disabled = true;
        status.textContent = error.message;
        toast(error.message, "bad");
      }
      return;
    }
    const selector = scope?.querySelector('select[name="mediaType"],[data-item-type]');
    if (selector) selector.value = "image";
    setUnsaved(scope, true);
  }

  function handleStoriesChange(event) {
    if (event.target.matches('input[name="media"],[data-item-file]')) return void handleMediaSelection(event);
    const scope = event.target.closest("[data-item-create],[data-item-card]");
    if (scope) setUnsaved(scope, true);
  }

  async function directVideoUpload(storyId, file, statusNode) {
    if (!file) return null;
    if (file.size > VIDEO_LIMIT_BYTES) throw new Error("Video maksimum 1 GB ola bilər.");
    validateVideoSelection(file);
    let lastError;
    for (let attempt = 0; attempt <= VIDEO_RETRY_DELAYS.length; attempt += 1) {
      let operationId = "";
      try {
        if (attempt > 0) {
          statusNode.textContent = `Bağlantı yenidən qurulur — yenidən cəhd edilir (${attempt}/3)`;
          await wait(VIDEO_RETRY_DELAYS[attempt - 1]);
        }
        const prepared = await api(`/api/admin/stories/${storyId}/video-uploads`, { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }) });
        operationId = prepared.upload.operationId;
        statusNode.textContent = "Video yüklənir… 0%";
        await uploadSignedFile(prepared.upload.signedUrl, file, (percent) => { statusNode.textContent = `Video yüklənir… ${percent}%`; });
        statusNode.textContent = "Yükləmə tamamlandı, yoxlanır…";
        await api(`/api/admin/story-video-uploads/${operationId}/verify`, { method: "POST" });
        return operationId;
      } catch (error) {
        lastError = error;
        if (operationId) await api(`/api/admin/story-video-uploads/${operationId}`, { method: "DELETE" }).catch(() => {});
        const retryable = error.retryable || !error.status || [408, 429, 500, 502, 503, 504].includes(error.status);
        if (!retryable || attempt === VIDEO_RETRY_DELAYS.length) throw error;
      }
    }
    throw lastError || new Error("Video yüklənmədi.");
  }

  function installView() {
    const bannerButton = document.querySelector('.navBtn[data-view="banners"]');
    if (bannerButton && !document.querySelector('.navBtn[data-view="stories"]')) {
      const button = document.createElement("button");
      button.className = "navBtn"; button.type = "button"; button.dataset.view = "stories"; button.textContent = "Stories";
      bannerButton.after(button);
      button.addEventListener("click", () => queueMicrotask(() => { document.getElementById("crumb").textContent = "Stories"; loadStories(); }));
    }
    if (document.getElementById("storiesView")) return;
    const view = document.createElement("section");
    view.id = "storiesView"; view.className = "workspace hidden cmsWorkspace";
    view.innerHTML = `<div class="panel editorPanel cmsPanel">
      <div class="panelHead"><div><h2>Stories</h2><p>Ana səhifədə görünən story dairələrini və media ardıcıllığını idarə edin.</p></div><button class="btn" id="storiesRefresh" type="button">Yenilə</button></div>
      <div class="storyAdminStats" id="storyAdminStats"></div>
      <form class="storyAdminCreate" id="storyCreateForm">
        <h3>Yeni story kateqoriyası</h3>
        <label>Başlıq<input name="title" maxlength="80" required></label>
        <label>Sıra<input name="sortOrder" type="number" min="1" value="1" required></label>
        <label>Cover şəkli<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" required><small>Yalnız dairədə görünür. Ana səhifə üçün aşağıdan ən azı 1 aktiv element əlavə edin.</small></label>
        <label class="switchLine"><input name="active" type="checkbox" checked><span>Aktiv</span></label>
        <button class="btn primary" type="submit">Story yarat</button>
      </form>
      <div class="storiesAdminList" id="storiesAdminList"></div>
    </div>`;
    document.querySelector(".main").appendChild(view);
    document.getElementById("storiesRefresh").addEventListener("click", loadStories);
    document.getElementById("storyCreateForm").addEventListener("submit", createStory);
    document.getElementById("storiesAdminList").addEventListener("click", handleAction);
    document.getElementById("storiesAdminList").addEventListener("change", handleStoriesChange);
    window.addEventListener("beforeunload", (event) => {
      if (!document.querySelector('[data-unsaved="true"]')) return;
      event.preventDefault(); event.returnValue = "";
    });
  }

  function mediaPreview(item) {
    return item.media_type === "video"
      ? `<video src="${escs(item.mediaUrl)}" controls muted playsinline preload="metadata"></video>`
      : `<img src="${escs(item.mediaUrl)}" alt="${escs(item.caption || "Story şəkli")}">`;
  }

  function render() {
    document.getElementById("storyAdminStats").innerHTML = `<span><b>${snapshot.activeStories}</b> aktiv story</span><span><b>${snapshot.activeItems}</b> aktiv media</span>`;
    document.getElementById("storiesAdminList").innerHTML = snapshot.stories.map((story) => `<article class="storyAdminCard" data-story-card="${story.id}">
      <div class="storyAdminHead">
        <img src="${escs(story.coverUrl)}" alt="">
        <label>Başlıq<input data-story-title value="${escs(story.title)}" maxlength="80"></label>
        <label>Sıra<input data-story-order type="number" min="1" value="${story.sort_order}"></label>
        <label class="switchLine"><input data-story-active type="checkbox" ${story.active ? "checked" : ""}><span>Aktiv</span></label>
        <label>Cover-i dəyiş<input data-story-cover type="file" accept="image/jpeg,image/png,image/webp"></label>
        <button class="btn" type="button" data-story-save="${story.id}">Yadda saxla</button>
        <button class="btn danger" type="button" data-story-delete="${story.id}">Story-ni sil</button>
      </div>
      <div class="storyAdminItems">${story.items.map((item) => `<div class="storyAdminItem" data-item-card="${item.id}">
        <div class="storyAdminPreview">${mediaPreview(item)}</div>
        <label>Qısa izah<input data-item-caption maxlength="240" value="${escs(item.caption)}"></label>
        <label>Sıra<input data-item-order type="number" min="1" value="${item.sort_order}"></label>
        <label class="switchLine"><input data-item-active type="checkbox" ${item.active ? "checked" : ""}><span>Aktiv</span></label>
        <label>Medianı dəyiş<input data-item-file type="file" accept="image/jpeg,image/png,image/webp,video/*,.mp4,.mov,.webm"></label>
        <select data-item-type><option value="image" ${item.media_type === "image" ? "selected" : ""}>Şəkil</option><option value="video" ${item.media_type === "video" ? "selected" : ""}>Video</option></select>
        <small data-upload-status aria-live="polite"></small><button class="btn storyUploadRetry" type="button" data-upload-retry hidden>Yenidən cəhd et</button><button class="btn primary storyFinalSave" type="button" data-item-save="${item.id}" disabled>Dəyişiklikləri yadda saxla</button>
        <button class="btn danger" type="button" data-item-delete="${item.id}">Sil</button>
      </div>`).join("") || '<p class="emptyState bad">Bu story ana səhifədə görünmür: cover yalnız dairə üçündür. Aşağıdan ən azı 1 aktiv şəkil və ya video elementi əlavə edin.</p>'}</div>
      <form class="storyItemCreate" data-item-create="${story.id}">
        <h4>Yeni element</h4><select name="mediaType"><option value="image">Şəkil</option><option value="video">Video</option></select>
        <input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/*,.mp4,.mov,.webm" required>
        <input name="caption" maxlength="240" placeholder="Qısa izah (istəyə bağlı)">
        <input name="sortOrder" type="number" min="1" value="${story.items.length + 1}" aria-label="Sıra">
        <label class="switchLine"><input name="active" type="checkbox" checked><span>Aktiv</span></label>
        <small data-upload-status aria-live="polite">Şəkil: 5 MB · Video: MP4, MOV və WebM · maksimum 1 GB</small>
        <button class="btn storyUploadRetry" data-upload-retry type="button" hidden>Yenidən cəhd et</button>
        <button class="btn primary storyFinalSave" data-story-final-save type="submit" disabled>Story-ni yadda saxla</button>
      </form>
    </article>`).join("") || '<p class="emptyState">Hələ story yaradılmayıb.</p>';
    document.querySelectorAll("[data-item-create]").forEach((form) => form.addEventListener("submit", createItem));
  }

  async function loadStories() {
    const list = document.getElementById("storiesAdminList"); if (!list) return;
    list.innerHTML = '<p class="emptyState">Stories yüklənir…</p>';
    try { snapshot = await api("/api/admin/stories"); render(); }
    catch (error) { list.innerHTML = `<p class="emptyState bad">${escs(error.message)}</p>`; }
  }

  async function createStory(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
    try {
      await api("/api/admin/stories", { method: "POST", body: JSON.stringify({ title: form.title.value, sortOrder: form.sortOrder.value, active: form.active.checked, cover: await uploadPayload(form.cover.files[0], "image") }) });
      form.reset(); form.sortOrder.value = "1"; form.active.checked = true; toast("Story yaradıldı. Ana səhifədə görünməsi üçün aktiv element əlavə edin."); await loadStories();
    } catch (error) { toast(error.message, "bad"); } finally { button.disabled = false; }
  }

  async function createItem(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button[type=submit]"); button.disabled = true;
    try {
      const kind = form.mediaType.value; const storyId = form.dataset.itemCreate; const file = form.media.files[0];
      if (form.dataset.uploading) throw new Error("Video yüklənir. Yükləmə tamamlanandan sonra yadda saxlayın.");
      const directUploadId = kind === "video" ? form.dataset.directUploadId : null;
      if (kind === "video" && !directUploadId) throw new Error("Video hələ yüklənməyib. Yükləmə tamamlanandan sonra yadda saxlayın.");
      await api(`/api/admin/stories/${storyId}/items`, { method: "POST", body: JSON.stringify({ mediaType: kind, media: kind === "image" ? await uploadPayload(file, kind) : null, directUploadId, caption: form.caption.value, sortOrder: form.sortOrder.value, active: form.active.checked }) });
      setUnsaved(form, false); delete form.dataset.directUploadId;
      toast("Story uğurla yadda saxlanıldı."); await loadStories();
    } catch (error) { toast(error.message, "bad"); } finally { button.disabled = false; }
  }

  async function handleAction(event) {
    const storySave = event.target.closest("[data-story-save]"); const storyDelete = event.target.closest("[data-story-delete]");
    const itemSave = event.target.closest("[data-item-save]"); const itemDelete = event.target.closest("[data-item-delete]");
    const uploadRetry = event.target.closest("[data-upload-retry]");
    try {
      if (uploadRetry) {
        const scope = uploadRetry.closest("[data-item-create],[data-item-card]");
        const input = scope.querySelector('input[name="media"],[data-item-file]');
        if (!input.files[0]) return toast("Video seçimi tapılmadı. Videonu yenidən seçin.", "bad");
        return startVideoUpload(scope, input, input.files[0]);
      }
      if (storyDelete) {
        if (!confirm("Bu story və bütün elementləri silinsin? Bu əməliyyat geri qaytarılmır.")) return;
        await api(`/api/admin/stories/${storyDelete.dataset.storyDelete}`, { method: "DELETE" }); toast("Story silindi."); return loadStories();
      }
      if (storySave) {
        const card = storySave.closest("[data-story-card]"); storySave.disabled = true;
        await api(`/api/admin/stories/${storySave.dataset.storySave}`, { method: "PATCH", body: JSON.stringify({ title: card.querySelector("[data-story-title]").value, sortOrder: card.querySelector("[data-story-order]").value, active: card.querySelector("[data-story-active]").checked, cover: await uploadPayload(card.querySelector("[data-story-cover]").files[0], "image") }) });
        toast("Story yeniləndi."); return loadStories();
      }
      if (itemDelete) {
        if (!confirm("Bu story elementi silinsin?")) return;
        const card = itemDelete.closest("[data-item-card]"); card.dataset.pendingDelete = "true";
        card.querySelector("[data-upload-status]").textContent = "Silinmə yadda saxlanmayıb. Dəyişiklikləri yadda saxlayın.";
        itemDelete.disabled = true; setUnsaved(card, true); return;
      }
      if (itemSave) {
        const card = itemSave.closest("[data-item-card]"); itemSave.disabled = true;
        if (card.dataset.pendingDelete === "true") {
          await api(`/api/admin/story-items/${itemSave.dataset.itemSave}`, { method: "DELETE" });
          setUnsaved(card, false); toast("Story uğurla yadda saxlanıldı."); return loadStories();
        }
        if (card.dataset.uploading) throw new Error("Video yüklənir. Yükləmə tamamlanandan sonra yadda saxlayın.");
        const kind = card.querySelector("[data-item-type]").value; const file = card.querySelector("[data-item-file]").files[0];
        const directUploadId = kind === "video" && file ? card.dataset.directUploadId : null;
        if (kind === "video" && file && !directUploadId) throw new Error("Video hələ yüklənməyib. Yükləmə tamamlanandan sonra yadda saxlayın.");
        await api(`/api/admin/story-items/${itemSave.dataset.itemSave}`, { method: "PATCH", body: JSON.stringify({ mediaType: kind, media: kind === "image" ? await uploadPayload(file, kind) : null, directUploadId, caption: card.querySelector("[data-item-caption]").value, sortOrder: card.querySelector("[data-item-order]").value, active: card.querySelector("[data-item-active]").checked }) });
        setUnsaved(card, false); delete card.dataset.directUploadId;
        toast("Story uğurla yadda saxlanıldı."); return loadStories();
      }
    } catch (error) { toast(error.message, "bad"); storySave && (storySave.disabled = false); itemSave && (itemSave.disabled = false); }
  }

  function boot() { installView(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
