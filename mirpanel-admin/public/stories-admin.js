(() => {
  const escs = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  let snapshot = { stories: [], activeStories: 0, activeItems: 0, limits: { imageMb: 5, videoMb: 25 } };

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
    const limit = (kind === "video" ? snapshot.limits.videoMb : snapshot.limits.imageMb) * 1024 * 1024;
    if (file.size > limit) throw new Error(`Fayl maksimum ${kind === "video" ? snapshot.limits.videoMb : snapshot.limits.imageMb} MB ola bilər.`);
    return { fileName: file.name, mimeType: file.type, contentBase64: await fileBase64(file) };
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
        <label>Medianı dəyiş<input data-item-file type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"></label>
        <select data-item-type><option value="image" ${item.media_type === "image" ? "selected" : ""}>Şəkil</option><option value="video" ${item.media_type === "video" ? "selected" : ""}>Video</option></select>
        <button class="btn" type="button" data-item-save="${item.id}">Yadda saxla</button>
        <button class="btn danger" type="button" data-item-delete="${item.id}">Sil</button>
      </div>`).join("") || '<p class="emptyState bad">Bu story ana səhifədə görünmür: cover yalnız dairə üçündür. Aşağıdan ən azı 1 aktiv şəkil və ya video elementi əlavə edin.</p>'}</div>
      <form class="storyItemCreate" data-item-create="${story.id}">
        <h4>Yeni element</h4><select name="mediaType"><option value="image">Şəkil</option><option value="video">Video</option></select>
        <input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required>
        <input name="caption" maxlength="240" placeholder="Qısa izah (istəyə bağlı)">
        <input name="sortOrder" type="number" min="1" value="${story.items.length + 1}" aria-label="Sıra">
        <label class="switchLine"><input name="active" type="checkbox" checked><span>Aktiv</span></label>
        <button class="btn primary" type="submit">Element əlavə et</button>
        <small>Şəkil: 5 MB · Video: 25 MB. JPG, PNG, WEBP, MP4 və WEBM.</small>
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
      const kind = form.mediaType.value;
      await api(`/api/admin/stories/${form.dataset.itemCreate}/items`, { method: "POST", body: JSON.stringify({ mediaType: kind, media: await uploadPayload(form.media.files[0], kind), caption: form.caption.value, sortOrder: form.sortOrder.value, active: form.active.checked }) });
      toast("Story elementi əlavə edildi."); await loadStories();
    } catch (error) { toast(error.message, "bad"); } finally { button.disabled = false; }
  }

  async function handleAction(event) {
    const storySave = event.target.closest("[data-story-save]"); const storyDelete = event.target.closest("[data-story-delete]");
    const itemSave = event.target.closest("[data-item-save]"); const itemDelete = event.target.closest("[data-item-delete]");
    try {
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
        await api(`/api/admin/story-items/${itemDelete.dataset.itemDelete}`, { method: "DELETE" }); toast("Story elementi silindi."); return loadStories();
      }
      if (itemSave) {
        const card = itemSave.closest("[data-item-card]"); const kind = card.querySelector("[data-item-type]").value; itemSave.disabled = true;
        await api(`/api/admin/story-items/${itemSave.dataset.itemSave}`, { method: "PATCH", body: JSON.stringify({ mediaType: kind, media: await uploadPayload(card.querySelector("[data-item-file]").files[0], kind), caption: card.querySelector("[data-item-caption]").value, sortOrder: card.querySelector("[data-item-order]").value, active: card.querySelector("[data-item-active]").checked }) });
        toast("Story elementi yeniləndi."); return loadStories();
      }
    } catch (error) { toast(error.message, "bad"); storySave && (storySave.disabled = false); itemSave && (itemSave.disabled = false); }
  }

  function boot() { installView(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
