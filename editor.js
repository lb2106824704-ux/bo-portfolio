(() => {
  const textSelector = 'h1,h2,h3,h4,p,li,.brand-name,.collection-kicker,.collection-cover-title > span,.signal-bar b,.signal-bar small,.collection-count,.case-topline > span,.timeline-date,.timeline-item .role,.skill-group b,.contact-details > *,.site-footer > *';
  const textKey = 'bo-portfolio-editor-text';
  const dbName = 'bo-portfolio-editor';
  const storeName = 'images';
  const status = document.createElement('div');
  status.className = 'editor-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const toolbar = document.createElement('aside');
  toolbar.className = 'editor-toolbar';
  toolbar.setAttribute('aria-label', '作品集编辑工具');
  toolbar.innerHTML = '<button type="button" class="editor-toggle">编辑内容</button><button type="button" class="editor-save" hidden>保存</button><button type="button" class="editor-export" hidden>导出备份</button><button type="button" class="editor-import" hidden>导入备份</button><input class="editor-file" type="file" accept="application/json" hidden><button type="button" class="editor-close" hidden>退出编辑</button>';
  // View-only mode: keep applying saved browser content, but expose no edit UI.

  let db;
  let editing = false;
  let statusTimer;
  const imageSlots = [...document.querySelectorAll('.hero-visual,.collection-cover:not(.video-upload-slot),.subproject-image:not(.video-upload-slot),.case-gallery .gallery-image,.about-wall .gallery-image')];
  imageSlots.forEach(slot => {
    const image = slot.querySelector('img');
    const owner = slot.closest('.case-study,.collection-block')?.id || slot.classList[0] || 'site';
    const source = image?.getAttribute('src') || 'no-image';
    slot.dataset.editorImageKey = slot.dataset.editorImageKey || `image-${owner}-${source}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    slot.classList.add('editor-image-slot');
  });
  const videoSlots = [...document.querySelectorAll('.video-upload-slot')];
  const videoObjectUrls = new Map();
  videoSlots.forEach(slot => {
    slot.classList.add('editor-video-slot');
    if (slot.closest('.video-project-grid')) {
      const video = slot.querySelector('video');
      const preview = () => { if (slot.classList.contains('has-video')) video.play().catch(() => {}); };
      const pause = () => video.pause();
      slot.addEventListener('pointerenter', preview);
      slot.addEventListener('pointerleave', pause);
      slot.addEventListener('focusin', preview);
      slot.addEventListener('focusout', event => { if (!slot.contains(event.relatedTarget)) pause(); });
    }
  });
  const editable = [...document.querySelectorAll(textSelector)].filter(el => !el.closest('.editor-toolbar,.editor-status,.lightbox,.video-empty-state'));
  const legacyEditable = [...editable];
  const textCounters = new Map();
  editable.forEach(el => {
    const owner = el.closest('.case-study,.collection-block')?.id || el.closest('section')?.id || 'site';
    const index = textCounters.get(owner) || 0;
    textCounters.set(owner, index + 1);
    el.dataset.editorTextKey = el.dataset.editorTextKey || `text-${owner}-${index}`;
  });

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onerror = () => reject(request.error);
    });
  }
  function dbAction(mode, action, key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action === 'delete' ? tx.objectStore(storeName).delete(key) : action === 'get' ? tx.objectStore(storeName).get(key) : tx.objectStore(storeName).put(value, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function tell(message) {
    status.textContent = message;
    status.classList.add('is-visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove('is-visible'), 3500);
  }
  function refreshSlot(slot, record) {
    const img = slot.querySelector('img');
    if (!img) return;
    slot.classList.toggle('is-image-deleted', Boolean(record && record.deleted));
    if (record && record.blob) {
      img.src = URL.createObjectURL(record.blob);
      if (slot.matches('.gallery-image')) slot.dataset.image = img.src;
    }
    img.hidden = Boolean(record && record.deleted);
    if (record && record.deleted && slot.matches('.gallery-image')) slot.dataset.image = '';
  }
  function refreshVideoSlot(slot, record) {
    const video = slot.querySelector('video');
    if (!video) return;
    const oldUrl = videoObjectUrls.get(slot);
    if (oldUrl) { URL.revokeObjectURL(oldUrl); videoObjectUrls.delete(slot); }
    slot.classList.toggle('has-video', Boolean(record && record.blob && !record.deleted));
    slot.classList.toggle('is-video-deleted', Boolean(record && record.deleted));
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (record && record.blob && !record.deleted) {
      const url = URL.createObjectURL(record.blob);
      videoObjectUrls.set(slot, url);
      video.src = url;
      video.load();
      if (video.hasAttribute('autoplay') || slot.matches(':hover') || slot.contains(document.activeElement)) video.play().catch(() => {});
    }
  }
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing-content', on);
    toolbar.querySelector('.editor-toggle').hidden = on;
    toolbar.querySelectorAll('.editor-save,.editor-export,.editor-import,.editor-close').forEach(button => { button.hidden = !on; });
    tell(on ? '编辑已开启：点击文字修改；图片拖入替换；视频拖入素材，右键可移除。' : '已退出编辑模式。');
  }
  function saveText() {
    clearCaseDeckFrames();
    const values = {};
    editable.forEach(el => { values[el.dataset.editorTextKey] = el.innerHTML; });
    localStorage.setItem(textKey, JSON.stringify(values));
  }
  function restoreText(values) {
    editable.forEach(el => { if (values[el.dataset.editorTextKey] != null) el.innerHTML = values[el.dataset.editorTextKey]; });
    clearCaseDeckFrames();
  }
  function clearCaseDeckFrames() {
    document.querySelectorAll('.case-title-row .case-deck, .case-title-row .case-deck *').forEach(el => {
      ['border','outline','box-shadow','background','background-color'].forEach(property => el.style.removeProperty(property));
      el.removeAttribute('border');
    });
  }
  function migrateLegacyText(values) {
    const jblCase = document.querySelector('#case-jbl');
    let changed = false;
    legacyEditable.forEach((el, index) => {
      const key = el.dataset.editorTextKey;
      if (values[key] != null) return;
      const explicitLegacy = el.dataset.editorLegacyTextIndex;
      if (explicitLegacy == null) return;
      const legacyIndex = Number(explicitLegacy);
      const legacyValue = values[`text-${legacyIndex}`];
      if (legacyValue != null) { values[key] = legacyValue; changed = true; }
    });
    if (changed) localStorage.setItem(textKey, JSON.stringify(values));
  }
  function slotForLegacyImageKey(key) {
    const match = /^image-(\d+)$/.exec(key);
    if (!match) return imageSlots.find(item => item.dataset.editorImageKey === key);
    const oldIndex = match[1];
    return imageSlots.find(item => item.dataset.editorLegacyImageIndex === oldIndex) || null;
  }
  function imageKeyAliases(slot) {
    const owner = slot.closest('.case-study,.collection-block')?.id;
    const source = slot.querySelector('img')?.getAttribute('src') || '';
    const safe = value => value.replace(/[^a-zA-Z0-9_-]/g, '_');
    const aliases = [];
    return aliases;
  }
  function fileToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  async function exportBackup() {
    const imageData = {};
    for (const slot of imageSlots) {
      const key = slot.dataset.editorImageKey;
      const record = await dbAction('readonly', 'get', key);
      if (record) imageData[key] = { deleted: !!record.deleted, data: record.blob ? await fileToDataUrl(record.blob) : null, type: record.blob?.type || '' };
    }
    const videoData = {};
    for (const slot of videoSlots) {
      const key = slot.dataset.editorVideoKey;
      const record = await dbAction('readonly', 'get', key);
      if (record) videoData[key] = { deleted: !!record.deleted, data: record.blob ? await fileToDataUrl(record.blob) : null, type: record.blob?.type || '' };
    }
    const payload = { format: 'bo-photo-portfolio-edit-v1', texts: JSON.parse(localStorage.getItem(textKey) || '{}'), images: imageData, videos: videoData };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bo-photo-portfolio-edit-backup.json';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    // Let the browser start saving the file before revoking its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    tell('编辑备份已导出。它只保存修改记录，不会自动发布到线上。');
  }
  async function importBackup(file) {
    const data = JSON.parse(await file.text());
    if (data.format !== 'bo-photo-portfolio-edit-v1') throw new Error('不支持的备份格式');
    const restoredTexts = data.texts || {};
    migrateLegacyText(restoredTexts);
    restoreText(restoredTexts);
    localStorage.setItem(textKey, JSON.stringify(restoredTexts));
    for (const [key, record] of Object.entries(data.images || {})) {
      const slot = slotForLegacyImageKey(key);
      if (!slot) continue;
      if (record.deleted) await dbAction('readwrite', 'put', key, { deleted: true });
      else if (record.data) {
        const response = await fetch(record.data);
        await dbAction('readwrite', 'put', key, { blob: await response.blob(), deleted: false });
      }
      refreshSlot(slot, await dbAction('readonly', 'get', key));
    }
    for (const [key, record] of Object.entries(data.videos || {})) {
      const slot = videoSlots.find(item => item.dataset.editorVideoKey === key);
      if (!slot) continue;
      if (record.deleted) await dbAction('readwrite', 'put', key, { deleted: true });
      else if (record.data) {
        const response = await fetch(record.data);
        await dbAction('readwrite', 'put', key, { blob: await response.blob(), deleted: false });
      }
      refreshVideoSlot(slot, await dbAction('readonly', 'get', key));
    }
    tell('备份已载入当前浏览器。');
  }

  toolbar.querySelector('.editor-toggle').addEventListener('click', () => setEditing(true));
  toolbar.querySelector('.editor-close').addEventListener('click', () => { saveText(); setEditing(false); });
  toolbar.querySelector('.editor-save').addEventListener('click', () => { saveText(); tell('文字已保存到当前浏览器。'); });
  toolbar.querySelector('.editor-export').addEventListener('click', () => exportBackup().catch(error => tell(`导出失败：${error.message || '请重试。'}`)));
  toolbar.querySelector('.editor-import').addEventListener('click', () => toolbar.querySelector('.editor-file').click());
  toolbar.querySelector('.editor-file').addEventListener('change', event => {
    if (event.target.files[0]) importBackup(event.target.files[0]).catch(error => tell(`导入失败：${error.message}`));
    event.target.value = '';
  });

  document.addEventListener('click', event => {
    if (!editing) return;
    const el = event.target.closest('[data-editor-text-key]');
    if (!el || el.closest('.editor-toolbar,.editor-status,.lightbox')) return;
    event.preventDefault();
    el.contentEditable = 'true';
    el.focus();
  }, true);
  document.addEventListener('focusout', event => {
    const el = event.target.closest('[data-editor-text-key][contenteditable="true"]');
    if (!el) return;
    el.contentEditable = 'false';
    saveText();
  });
  document.addEventListener('dragover', event => {
    if (!editing || !event.dataTransfer?.types.includes('Files')) return;
    const slot = event.target.closest('.editor-image-slot,.editor-video-slot');
    if (!slot) return;
    event.preventDefault();
    slot.classList.add('is-drop-target');
  });
  document.addEventListener('dragleave', event => {
    const slot = event.target.closest('.editor-image-slot,.editor-video-slot');
    if (slot && !slot.contains(event.relatedTarget)) slot.classList.remove('is-drop-target');
  });
  document.addEventListener('drop', async event => {
    if (!editing) return;
    const slot = event.target.closest('.editor-image-slot,.editor-video-slot');
    if (!slot) return;
    event.preventDefault();
    slot.classList.remove('is-drop-target');
    const files = [...(event.dataTransfer?.files || [])];
    if (slot.matches('.editor-video-slot')) {
      const file = files.find(item => item.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(item.name));
      if (!file) { tell('请拖入 MP4、WebM、MOV 等视频文件。'); return; }
      const key = slot.dataset.editorVideoKey;
      await dbAction('readwrite', 'put', key, { blob: file, deleted: false });
      refreshVideoSlot(slot, await dbAction('readonly', 'get', key));
      tell('视频已载入并保存在当前浏览器。');
      return;
    }
    const file = files.find(item => item.type.startsWith('image/'));
    if (!file) { tell('此位置需要图片文件。'); return; }
    await dbAction('readwrite', 'put', slot.dataset.editorImageKey, { blob: file, deleted: false });
    refreshSlot(slot, await dbAction('readonly', 'get', slot.dataset.editorImageKey));
    tell('图片已替换并保存在当前浏览器。');
  });
  document.addEventListener('contextmenu', async event => {
    if (!editing) return;
    const videoSlot = event.target.closest('.editor-video-slot');
    if (videoSlot) {
      event.preventDefault();
      const key = videoSlot.dataset.editorVideoKey;
      await dbAction('readwrite', 'put', key, { deleted: true });
      refreshVideoSlot(videoSlot, { deleted: true });
      tell('视频已移除；拖入新视频可替换此位置。');
      return;
    }
    const img = event.target.closest('.editor-image-slot img');
    if (!img) return;
    event.preventDefault();
    const slot = img.closest('.editor-image-slot');
    await dbAction('readwrite', 'put', slot.dataset.editorImageKey, { deleted: true });
    refreshSlot(slot, { deleted: true });
    tell('图片已移除；拖入新图可替换此位置。');
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.editor-video-slot video')) event.stopPropagation();
  }, true);

  openDb().then(async () => {
    const savedText = JSON.parse(localStorage.getItem(textKey) || '{}');
    migrateLegacyText(savedText);
    restoreText(savedText);
    for (const [index, slot] of imageSlots.entries()) {
      let record = await dbAction('readonly', 'get', slot.dataset.editorImageKey);
      if (!record) {
        for (const alias of imageKeyAliases(slot)) {
          record = await dbAction('readonly', 'get', alias);
          if (record) break;
        }
        if (!record && slot.dataset.editorLegacyImageIndex != null) record = await dbAction('readonly', 'get', `image-${slot.dataset.editorLegacyImageIndex}`);
        if (record) await dbAction('readwrite', 'put', slot.dataset.editorImageKey, record);
      }
      if (record) refreshSlot(slot, record);
    }
    for (const slot of videoSlots) {
      const record = await dbAction('readonly', 'get', slot.dataset.editorVideoKey);
      if (record) refreshVideoSlot(slot, record);
    }
  }).catch(() => tell('浏览器存储不可用：图片编辑无法持久保存。'));
})();



