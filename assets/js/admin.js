/* ============================================================
   admin.js  –  슬라이드 관리 페이지 로직
   ============================================================ */

// ── State ──────────────────────────────────────────────────────────────────────
let manifest = { slideshows: [] };
let currentId = null;   // 편집 중인 슬라이드쇼 id (null = 신규 생성 모드)
let pvIndex = 0;        // 미리보기 현재 슬라이드 인덱스
let insertAt = null;    // 이미지 삽입 위치 (null = 맨 끝)
let dragSrcIndex = null;// 드래그 소스 인덱스

// ── DOM refs ───────────────────────────────────────────────────────────────────
const listEl        = document.getElementById('slideshow-list');
const editPanel     = document.getElementById('edit-panel');
const formLabel     = document.getElementById('form-mode-label');
const inputTitle    = document.getElementById('input-title');
const inputId       = document.getElementById('input-id');
const inputGroup    = document.getElementById('input-group');
const idHint        = document.getElementById('id-readonly-hint');
const imageSection  = document.getElementById('image-section');
const deleteSection = document.getElementById('delete-section');
const imageList     = document.getElementById('image-list');
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const btnNew        = document.getElementById('btn-new-slideshow');
const btnSaveInfo   = document.getElementById('btn-save-info');
const btnCancel     = document.getElementById('btn-cancel');
const btnDelete     = document.getElementById('btn-delete-slideshow');
const previewEmpty  = document.getElementById('preview-empty');
const previewViewer = document.getElementById('preview-viewer');
const previewTitle  = document.getElementById('preview-title');
const previewCounter= document.getElementById('preview-counter');
const previewImg    = document.getElementById('preview-img');
const pvPrev        = document.getElementById('pv-prev');
const pvNext        = document.getElementById('pv-next');
const pvThumbs      = document.getElementById('preview-thumbs');
const toast         = document.getElementById('toast');

// ── Init ───────────────────────────────────────────────────────────────────────
loadManifest();

// ── API helpers ────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '오류가 발생했습니다.');
  return data;
}

// ── Manifest load / refresh ────────────────────────────────────────────────────
async function loadManifest() {
  try {
    manifest = await api('GET', '/api/manifest');
    renderList();
    if (currentId) {
      const ss = manifest.slideshows.find(s => s.id === currentId);
      if (ss) renderImageList(ss);
    }
  } catch (e) {
    showToast('manifest 로드 실패: ' + e.message, 'error');
  }
}

// ── List rendering ─────────────────────────────────────────────────────────────
function renderList() {
  listEl.innerHTML = '';
  if (!manifest.slideshows.length) {
    listEl.innerHTML = '<li class="list-empty">슬라이드쇼가 없습니다.</li>';
    return;
  }
  manifest.slideshows.forEach(ss => {
    const li = document.createElement('li');
    li.className = 'slideshow-item' + (ss.id === currentId ? ' active' : '');
    li.dataset.id = ss.id;

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'item-thumb';
    if (ss.thumbnail) {
      const img = document.createElement('img');
      img.src = ss.thumbnail + '?t=' + Date.now();
      img.onerror = () => { thumbDiv.innerHTML = '<div class="item-thumb-placeholder">🖼️</div>'; };
      thumbDiv.appendChild(img);
    } else {
      thumbDiv.innerHTML = '<div class="item-thumb-placeholder">🖼️</div>';
    }

    const info = document.createElement('div');
    info.className = 'item-info';
    info.innerHTML = `
      <div class="item-title">${esc(ss.title)}</div>
      <div class="item-meta">${ss.images.length}장 · ${ss.id}</div>
    `;

    li.appendChild(thumbDiv);
    li.appendChild(info);
    li.addEventListener('click', () => selectSlideshow(ss.id));
    listEl.appendChild(li);
  });
}

// ── Select slideshow (edit mode) ───────────────────────────────────────────────
function selectSlideshow(id) {
  currentId = id;
  insertAt = null;
  const ss = manifest.slideshows.find(s => s.id === id);
  if (!ss) return;

  // Form fill
  formLabel.textContent = '슬라이드 편집';
  inputTitle.value = ss.title;
  inputId.value = ss.id;
  inputId.readOnly = true;
  idHint.style.display = 'block';
  inputGroup.value = ss.group || '';
  imageSection.style.display = 'block';
  deleteSection.style.display = 'block';
  editPanel.style.display = 'block';

  renderList();
  renderImageList(ss);
  pvIndex = 0;
  renderPreview(ss);
}

// ── New slideshow mode ─────────────────────────────────────────────────────────
btnNew.addEventListener('click', () => {
  currentId = null;
  insertAt = null;
  formLabel.textContent = '새 슬라이드 등록';
  inputTitle.value = '';
  inputId.value = '';
  inputId.readOnly = false;
  idHint.style.display = 'none';
  inputGroup.value = '';
  imageSection.style.display = 'none';
  deleteSection.style.display = 'none';
  editPanel.style.display = 'block';
  renderList();
  showPreviewEmpty();
  inputTitle.focus();
});

// Auto-suggest directory name from title
inputTitle.addEventListener('input', () => {
  if (!currentId && !inputId.value) {
    inputId.value = slugify(inputTitle.value);
  }
});

btnCancel.addEventListener('click', () => {
  currentId = null;
  editPanel.style.display = 'none';
  showPreviewEmpty();
  renderList();
});

// ── Save info ──────────────────────────────────────────────────────────────────
btnSaveInfo.addEventListener('click', async () => {
  const title = inputTitle.value.trim();
  const id = inputId.value.trim();
  const group = inputGroup.value.trim() || 'General';

  if (!title) return showToast('슬라이드 제목을 입력하세요.', 'error');
  if (!id) return showToast('디렉토리명을 입력하세요.', 'error');
  if (!/^[a-z0-9_-]+$/i.test(id)) return showToast('디렉토리명은 영문·숫자·하이픈·언더스코어만 사용 가능합니다.', 'error');

  try {
    if (currentId) {
      // Update
      await api('PUT', `/api/slideshows/${currentId}`, { title, group });
      showToast('정보가 저장되었습니다.', 'success');
    } else {
      // Create
      const ss = await api('POST', '/api/slideshows', { id, title, group });
      currentId = ss.id;
      inputId.readOnly = true;
      idHint.style.display = 'block';
      imageSection.style.display = 'block';
      deleteSection.style.display = 'block';
      formLabel.textContent = '슬라이드 편집';
      showToast('슬라이드쇼가 생성되었습니다.', 'success');
    }
    await loadManifest();
    const ss = manifest.slideshows.find(s => s.id === currentId);
    if (ss) renderPreview(ss);
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ── Delete slideshow ───────────────────────────────────────────────────────────
btnDelete.addEventListener('click', async () => {
  const ss = manifest.slideshows.find(s => s.id === currentId);
  if (!confirm(`"${ss?.title}" 슬라이드쇼를 삭제하시겠습니까?\n이미지 파일도 모두 삭제됩니다.`)) return;
  try {
    await api('DELETE', `/api/slideshows/${currentId}`);
    currentId = null;
    editPanel.style.display = 'none';
    showPreviewEmpty();
    await loadManifest();
    showToast('슬라이드쇼가 삭제되었습니다.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

// ── Image list rendering ───────────────────────────────────────────────────────
function renderImageList(ss) {
  imageList.innerHTML = '';

  // 맨 위 삽입 버튼
  imageList.appendChild(makeInsertRow(0, ss));

  ss.images.forEach((filename, idx) => {
    const li = document.createElement('li');
    li.className = 'image-item';
    li.draggable = true;
    li.dataset.index = idx;

    const imgSrc = `${ss.directory}/${filename}?t=${Date.now()}`;

    li.innerHTML = `
      <span class="drag-handle" title="드래그하여 순서 변경">⋮⋮</span>
      <div class="img-thumb-sm" title="클릭하여 미리보기">
        <img src="${imgSrc}" alt="${esc(filename)}" loading="lazy">
      </div>
      <span class="img-name" title="${esc(filename)}">${esc(filename)}</span>
      <span class="img-index">${idx + 1}</span>
      <button class="btn-del-img" title="삭제" data-filename="${esc(filename)}">✕</button>
    `;

    // Thumb click → preview
    li.querySelector('.img-thumb-sm').addEventListener('click', () => {
      pvIndex = idx;
      updatePreviewSlide(ss);
    });

    // Delete
    li.querySelector('.btn-del-img').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteImage(ss, filename);
    });

    // Drag events
    li.addEventListener('dragstart', onDragStart);
    li.addEventListener('dragover', onDragOver);
    li.addEventListener('drop', onDrop);
    li.addEventListener('dragend', onDragEnd);

    imageList.appendChild(li);

    // 다음 위치 삽입 버튼
    imageList.appendChild(makeInsertRow(idx + 1, ss));
  });
}

function makeInsertRow(position, ss) {
  const row = document.createElement('li');
  row.className = 'insert-btn-row';
  const btn = document.createElement('button');
  btn.className = 'btn-insert';
  btn.textContent = '+ 여기에 삽입';
  btn.addEventListener('click', () => {
    insertAt = position;
    updateDropHint();
    fileInput.click();
  });
  row.appendChild(btn);
  return row;
}

function updateDropHint() {
  const hint = dropZone.querySelector('.drop-hint');
  if (insertAt !== null) {
    hint.textContent = `${insertAt + 1}번째 위치에 삽입됩니다`;
  } else {
    hint.textContent = '맨 끝에 추가됩니다';
  }
}

// ── Drag & Drop (image reorder) ────────────────────────────────────────────────
function onDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index, 10);
  this.classList.add('drag-src');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.image-item').forEach(el => el.classList.remove('drag-over-item'));
  this.classList.add('drag-over-item');
}

async function onDrop(e) {
  e.preventDefault();
  const targetIndex = parseInt(this.dataset.index, 10);
  if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

  const ss = manifest.slideshows.find(s => s.id === currentId);
  const images = [...ss.images];
  const [moved] = images.splice(dragSrcIndex, 1);
  images.splice(targetIndex, 0, moved);

  try {
    await api('PUT', `/api/slideshows/${currentId}/order`, { images });
    await loadManifest();
    const updated = manifest.slideshows.find(s => s.id === currentId);
    pvIndex = targetIndex;
    renderPreview(updated);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function onDragEnd() {
  document.querySelectorAll('.image-item').forEach(el => {
    el.classList.remove('drag-src', 'drag-over-item');
  });
  dragSrcIndex = null;
}

// ── File upload ────────────────────────────────────────────────────────────────
// Drop zone drag events
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (!currentId) return showToast('먼저 슬라이드쇼를 선택하세요.', 'error');
  uploadFiles(e.dataTransfer.files);
});
dropZone.addEventListener('click', () => {
  if (!currentId) return showToast('먼저 슬라이드쇼를 선택하세요.', 'error');
  insertAt = null;
  updateDropHint();
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) uploadFiles(fileInput.files);
  fileInput.value = '';
});

async function uploadFiles(files) {
  if (!currentId) return showToast('먼저 슬라이드쇼를 선택하세요.', 'error');
  const form = new FormData();
  for (const f of files) form.append('images', f);
  if (insertAt !== null) form.append('insertAt', insertAt);

  try {
    await api('POST', `/api/slideshows/${currentId}/images`, form);
    insertAt = null;
    updateDropHint();
    await loadManifest();
    const ss = manifest.slideshows.find(s => s.id === currentId);
    renderPreview(ss);
    showToast(`${files.length}장 업로드 완료`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Delete image ───────────────────────────────────────────────────────────────
async function deleteImage(ss, filename) {
  if (!confirm(`"${filename}" 이미지를 삭제하시겠습니까?`)) return;
  try {
    const updated = await api('DELETE', `/api/slideshows/${currentId}/images/${encodeURIComponent(filename)}`);
    await loadManifest();
    const newSs = manifest.slideshows.find(s => s.id === currentId);
    pvIndex = Math.min(pvIndex, Math.max(0, newSs.images.length - 1));
    renderPreview(newSs);
    showToast('이미지가 삭제되었습니다.', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Preview ────────────────────────────────────────────────────────────────────
function renderPreview(ss) {
  if (!ss || !ss.images.length) {
    previewTitle.textContent = ss ? ss.title : '';
    previewViewer.style.display = 'flex';
    previewEmpty.style.display = 'none';
    previewImg.src = '';
    previewCounter.textContent = '0 / 0';
    pvThumbs.innerHTML = '';
    pvPrev.disabled = true;
    pvNext.disabled = true;
    return;
  }

  previewEmpty.style.display = 'none';
  previewViewer.style.display = 'flex';
  previewTitle.textContent = ss.title;

  // Build thumbs
  pvThumbs.innerHTML = '';
  ss.images.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'pv-thumb' + (i === pvIndex ? ' active' : '');
    const im = document.createElement('img');
    im.src = `${ss.directory}/${img}?t=${Date.now()}`;
    im.loading = 'lazy';
    div.appendChild(im);
    div.addEventListener('click', () => { pvIndex = i; updatePreviewSlide(ss); });
    pvThumbs.appendChild(div);
  });

  updatePreviewSlide(ss);
}

function updatePreviewSlide(ss) {
  if (!ss.images.length) return;
  pvIndex = Math.max(0, Math.min(pvIndex, ss.images.length - 1));

  previewImg.classList.add('fade');
  setTimeout(() => {
    previewImg.src = `${ss.directory}/${ss.images[pvIndex]}?t=${Date.now()}`;
    previewImg.onload = () => previewImg.classList.remove('fade');
  }, 120);

  previewCounter.textContent = `${pvIndex + 1} / ${ss.images.length}`;
  pvPrev.disabled = pvIndex === 0;
  pvNext.disabled = pvIndex === ss.images.length - 1;

  // Active thumb
  pvThumbs.querySelectorAll('.pv-thumb').forEach((t, i) => t.classList.toggle('active', i === pvIndex));
  const activeThumb = pvThumbs.children[pvIndex];
  if (activeThumb) activeThumb.scrollIntoView({ inline: 'center', block: 'nearest' });
}

pvPrev.addEventListener('click', () => {
  const ss = manifest.slideshows.find(s => s.id === currentId);
  if (ss && pvIndex > 0) { pvIndex--; updatePreviewSlide(ss); }
});
pvNext.addEventListener('click', () => {
  const ss = manifest.slideshows.find(s => s.id === currentId);
  if (ss && pvIndex < ss.images.length - 1) { pvIndex++; updatePreviewSlide(ss); }
});

document.addEventListener('keydown', (e) => {
  if (!currentId) return;
  const ss = manifest.slideshows.find(s => s.id === currentId);
  if (!ss) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') { pvIndex = Math.max(0, pvIndex - 1); updatePreviewSlide(ss); }
  if (e.key === 'ArrowRight') { pvIndex = Math.min(ss.images.length - 1, pvIndex + 1); updatePreviewSlide(ss); }
});

function showPreviewEmpty() {
  previewEmpty.style.display = 'flex';
  previewViewer.style.display = 'none';
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function slugify(str) {
  return str.trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}
