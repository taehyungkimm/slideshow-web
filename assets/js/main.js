// 메인 페이지 - 슬라이드쇼 갤러리
(async function () {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const galleryEl = document.getElementById('gallery');

  try {
    const res = await fetch('slides/manifest.json');
    if (!res.ok) throw new Error('manifest.json not found');
    const data = await res.json();

    if (!data.slideshows || data.slideshows.length === 0) {
      throw new Error('No slideshows found');
    }

    // 슬라이드쇼를 디렉토리(그룹)별로 분류
    const groups = {};
    for (const ss of data.slideshows) {
      const group = ss.group || 'General';
      if (!groups[group]) groups[group] = [];
      groups[group].push(ss);
    }

    // 섹션별 렌더링
    for (const [groupName, slideshows] of Object.entries(groups)) {
      const section = document.createElement('div');
      section.className = 'gallery-section';

      const titleEl = document.createElement('h2');
      titleEl.className = 'section-title';
      titleEl.textContent = groupName;
      section.appendChild(titleEl);

      const grid = document.createElement('div');
      grid.className = 'cards-grid';

      for (const ss of slideshows) {
        grid.appendChild(buildCard(ss));
      }

      section.appendChild(grid);
      galleryEl.appendChild(section);
    }

    loadingEl.style.display = 'none';
    galleryEl.style.display = 'grid';

  } catch (err) {
    console.error(err);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }

  function buildCard(ss) {
    const a = document.createElement('a');
    a.className = 'slideshow-card';
    a.href = `viewer.html?id=${encodeURIComponent(ss.id)}`;

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'card-thumbnail';

    if (ss.thumbnail) {
      const img = document.createElement('img');
      img.src = ss.thumbnail;
      img.alt = ss.title;
      img.loading = 'lazy';
      img.onerror = () => {
        thumbDiv.innerHTML = '<div class="card-placeholder">🖼️</div>';
      };
      thumbDiv.appendChild(img);
    } else {
      thumbDiv.innerHTML = '<div class="card-placeholder">🖼️</div>';
    }

    const info = document.createElement('div');
    info.className = 'card-info';
    info.innerHTML = `
      <div class="card-title">${escapeHtml(ss.title)}</div>
      <div class="card-count">${ss.images.length}장의 이미지</div>
    `;

    a.appendChild(thumbDiv);
    a.appendChild(info);
    return a;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
