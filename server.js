const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3100;
const SLIDES_DIR = path.join(__dirname, 'slides');
const MANIFEST_PATH = path.join(SLIDES_DIR, 'manifest.json');
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|avif)$/i;

app.use(express.json());
app.use(express.static(__dirname));

// ── Manifest helpers ──────────────────────────────────────────────────────────
function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return { slideshows: [] };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function writeManifest(data) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function updateThumbnail(ss) {
  ss.thumbnail = ss.images.length > 0
    ? `${ss.directory}/${ss.images[0]}`
    : null;
}

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(SLIDES_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    // Sanitize filename: keep extension, replace special chars
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9._-]/gi, '_');
    let name = `${base}${ext}`;
    // Avoid collisions
    const dir = path.join(SLIDES_DIR, req.params.id);
    let counter = 1;
    while (fs.existsSync(path.join(dir, name))) {
      name = `${base}_${counter}${ext}`;
      counter++;
    }
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    cb(null, IMAGE_EXTS.test(file.originalname));
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────

// GET /api/manifest
app.get('/api/manifest', (req, res) => {
  res.json(readManifest());
});

// POST /api/slideshows — create new slideshow
app.post('/api/slideshows', (req, res) => {
  const { id, title, group } = req.body;

  if (!id || !/^[a-z0-9_-]+$/i.test(id)) {
    return res.status(400).json({ error: '디렉토리명은 영문/숫자/하이픈/언더스코어만 사용 가능합니다.' });
  }

  const manifest = readManifest();
  if (manifest.slideshows.find(s => s.id === id)) {
    return res.status(409).json({ error: '같은 디렉토리명의 슬라이드쇼가 이미 존재합니다.' });
  }

  fs.mkdirSync(path.join(SLIDES_DIR, id), { recursive: true });

  const slideshow = {
    id,
    title: title || id,
    group: group || 'General',
    directory: `slides/${id}`,
    thumbnail: null,
    images: []
  };
  manifest.slideshows.push(slideshow);
  writeManifest(manifest);
  res.json(slideshow);
});

// PUT /api/slideshows/:id — update title/group (directory name unchanged)
app.put('/api/slideshows/:id', (req, res) => {
  const manifest = readManifest();
  const ss = manifest.slideshows.find(s => s.id === req.params.id);
  if (!ss) return res.status(404).json({ error: '슬라이드쇼를 찾을 수 없습니다.' });

  if (req.body.title !== undefined) ss.title = req.body.title;
  if (req.body.group !== undefined) ss.group = req.body.group;
  writeManifest(manifest);
  res.json(ss);
});

// DELETE /api/slideshows/:id — delete slideshow + directory
app.delete('/api/slideshows/:id', (req, res) => {
  const manifest = readManifest();
  const idx = manifest.slideshows.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '슬라이드쇼를 찾을 수 없습니다.' });

  const dir = path.join(SLIDES_DIR, req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  manifest.slideshows.splice(idx, 1);
  writeManifest(manifest);
  res.json({ ok: true });
});

// POST /api/slideshows/:id/images — upload images (optional insertAt index)
app.post('/api/slideshows/:id/images', upload.array('images'), (req, res) => {
  const manifest = readManifest();
  const ss = manifest.slideshows.find(s => s.id === req.params.id);
  if (!ss) return res.status(404).json({ error: '슬라이드쇼를 찾을 수 없습니다.' });

  const newFiles = req.files.map(f => f.filename);
  const insertAt = (req.body.insertAt !== undefined && req.body.insertAt !== '')
    ? parseInt(req.body.insertAt, 10)
    : ss.images.length;

  ss.images.splice(insertAt, 0, ...newFiles);
  updateThumbnail(ss);
  writeManifest(manifest);
  res.json(ss);
});

// DELETE /api/slideshows/:id/images/:filename — delete one image
app.delete('/api/slideshows/:id/images/:filename', (req, res) => {
  const manifest = readManifest();
  const ss = manifest.slideshows.find(s => s.id === req.params.id);
  if (!ss) return res.status(404).json({ error: '슬라이드쇼를 찾을 수 없습니다.' });

  const { filename } = req.params;
  const idx = ss.images.indexOf(filename);
  if (idx !== -1) ss.images.splice(idx, 1);

  const filePath = path.join(SLIDES_DIR, req.params.id, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  updateThumbnail(ss);
  writeManifest(manifest);
  res.json(ss);
});

// PUT /api/slideshows/:id/order — reorder images
app.put('/api/slideshows/:id/order', (req, res) => {
  const manifest = readManifest();
  const ss = manifest.slideshows.find(s => s.id === req.params.id);
  if (!ss) return res.status(404).json({ error: '슬라이드쇼를 찾을 수 없습니다.' });

  if (!Array.isArray(req.body.images)) {
    return res.status(400).json({ error: 'images 배열이 필요합니다.' });
  }

  ss.images = req.body.images;
  updateThumbnail(ss);
  writeManifest(manifest);
  res.json(ss);
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n슬라이드쇼 서버 실행 중: http://localhost:${PORT}`);
  console.log(`갤러리:  http://localhost:${PORT}/index.html`);
  console.log(`관리자:  http://localhost:${PORT}/admin.html`);
  console.log('\n서버를 종료하려면 Ctrl+C 를 누르세요.\n');
});
