// 슬라이드 뷰어 페이지
(async function () {
  const loadingEl = document.getElementById('viewer-loading');
  const errorEl = document.getElementById('viewer-error');
  const viewerEl = document.getElementById('viewer');
  const titleEl = document.getElementById('viewer-title');
  const counterEl = document.getElementById('slide-counter');
  const imgEl = document.getElementById('slide-img');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const thumbStrip = document.getElementById('thumbnail-strip');

  const params = new URLSearchParams(location.search);
  const ssId = params.get('id');

  if (!ssId) {
    showError();
    return;
  }

  let slides = [];
  let current = 0;
  let touchStartX = 0;

  try {
    const res = await fetch('slides/manifest.json');
    if (!res.ok) throw new Error('manifest.json not found');
    const data = await res.json();

    const ss = data.slideshows.find(s => s.id === ssId);
    if (!ss) throw new Error('Slideshow not found: ' + ssId);

    document.title = ss.title + ' — 슬라이드 뷰어';
    titleEl.textContent = ss.title;
    slides = ss.images.map(img => `${ss.directory}/${img}`);

    buildThumbnails();
    goto(0);

    loadingEl.style.display = 'none';
    viewerEl.style.display = 'flex';

  } catch (err) {
    console.error(err);
    showError();
    return;
  }

  // ---- 이동 ----
  function goto(index) {
    if (index < 0 || index >= slides.length) return;

    imgEl.classList.add('fade');
    setTimeout(() => {
      current = index;
      imgEl.src = slides[current];
      imgEl.onload = () => imgEl.classList.remove('fade');
      imgEl.onerror = () => imgEl.classList.remove('fade');
      updateUI();
    }, 150);
  }

  function updateUI() {
    counterEl.textContent = `${current + 1} / ${slides.length}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;

    // 썸네일 활성화
    const thumbs = thumbStrip.querySelectorAll('.thumb-item');
    thumbs.forEach((t, i) => t.classList.toggle('active', i === current));

    // 썸네일 스크롤
    const activeThumb = thumbStrip.children[current];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  // ---- 버튼 ----
  prevBtn.addEventListener('click', () => goto(current - 1));
  nextBtn.addEventListener('click', () => goto(current + 1));

  // ---- 키보드 ----
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goto(current - 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goto(current + 1);
    if (e.key === 'Home') goto(0);
    if (e.key === 'End') goto(slides.length - 1);
  });

  // ---- 터치 스와이프 ----
  const container = document.getElementById('slide-container');
  container.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  container.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      dx < 0 ? goto(current + 1) : goto(current - 1);
    }
  }, { passive: true });

  // ---- 썸네일 생성 ----
  function buildThumbnails() {
    slides.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'thumb-item';
      const img = document.createElement('img');
      img.src = src;
      img.alt = `슬라이드 ${i + 1}`;
      img.loading = 'lazy';
      div.appendChild(img);
      div.addEventListener('click', () => goto(i));
      thumbStrip.appendChild(div);
    });
  }

  function showError() {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
})();
