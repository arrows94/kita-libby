
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { Database } = require('./sqlite');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || ''; // optional

app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/*','application/csv'], limit: '5mb' }));
app.use(cors({ origin: true, credentials: true }));

// --- DB init + migration ---
const db = new Database(process.env.DB_FILE || './data.sqlite');
async function init() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT,
      category TEXT,          -- legacy (first of categories)
      categories TEXT,        -- JSON array
      description TEXT,
      isbn TEXT,
      color1 TEXT,
      color2 TEXT,
      color3 TEXT,
      cover TEXT,
      views INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
    // Ensure color3 exists (migration)
    try {
      const cols = await db.all("PRAGMA table_info(books)");
      const hasColor3 = Array.isArray(cols) && cols.some(c => c.name === 'color3');
      if (!hasColor3) {
        await db.run("ALTER TABLE books ADD COLUMN color3 TEXT");
      }
    } catch (e) { /* ignore */ }

  try { await db.exec(`ALTER TABLE books ADD COLUMN categories TEXT`); } catch(e) {}

  const rows = await db.all(`SELECT id, category, categories FROM books`);
  for (const r of rows) {
    let cats = [];
    try { cats = JSON.parse(r.categories || '[]'); } catch { cats = []; }
    if ((!cats || cats.length === 0) && r.category) {
      cats = [r.category];
      await db.run(`UPDATE books SET categories = ? WHERE id = ?`, [JSON.stringify(cats), r.id]);
    }
  }
}
init().catch(console.error);

// --- Category meta (color) ---
async function initCatMeta() {
  await db.exec(`CREATE TABLE IF NOT EXISTS catmeta (name TEXT PRIMARY KEY, color TEXT)`);
}
initCatMeta().catch(console.error);

// --- Recommendation settings ---
async function initRecSettings(){
  await db.exec(`CREATE TABLE IF NOT EXISTS rec_settings (key TEXT PRIMARY KEY, value TEXT)`);
  const defaults = {
    enabled: '1',
    weightKeyword: '3',
    weightView: '1',
    maxItems: '12',
    keywords_winter: 'Winter,Schnee,Weihnachten,Nikolaus,Eis,Pinguin',
    keywords_fruehling: 'Frühling,Ostern,Blumen,Garten,Natur',
    keywords_sommer: 'Sommer,Baden,Meer,Reise,Sonne,Ferien',
    keywords_herbst: 'Herbst,Laterne,Sankt Martin,Ernte,Kürbis,Halloween'
  };
  for (const [k,v] of Object.entries(defaults)){
    const row = await db.get('SELECT value FROM rec_settings WHERE key=?', [k]);
    if (!row) await db.run('INSERT INTO rec_settings(key,value) VALUES(?,?)', [k, v]);
  }
}
initRecSettings().catch(console.error);

async function getRecSettingsObj(){
  const rows = await db.all('SELECT key, value FROM rec_settings');
  const m = {};
  rows.forEach(r => m[r.key] = r.value);
  return {
    enabled: m.enabled === '1',
    weightKeyword: parseInt(m.weightKeyword||'3',10),
    weightView: parseInt(m.weightView||'1',10),
    maxItems: Math.max(1, Math.min(50, parseInt(m.maxItems||'12',10))),
    keywords: {
      winter: (m.keywords_winter||'').split(',').map(s=>s.trim()).filter(Boolean),
      fruehling: (m.keywords_fruehling||'').split(',').map(s=>s.trim()).filter(Boolean),
      sommer: (m.keywords_sommer||'').split(',').map(s=>s.trim()).filter(Boolean),
      herbst: (m.keywords_herbst||'').split(',').map(s=>s.trim()).filter(Boolean),
    }
  };
}

// --- Auth helpers ---
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function requireRole(roles){
  return (req,res,next)=>{
    if(!req.user) return res.status(401).json({ error: 'No user' });
    if(!roles.includes(req.user.role)) return res.status(403) .json({ error: 'Forbidden' });
    next();
  }
}

// --- Routes ---
app.post('/login', (req, res) => {
  let { password, role } = req.body || {};
  role = role || 'admin';
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (role === 'admin') {
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  } else if (role === 'editor') {
    if (!EDITOR_PASSWORD) return res.status(400).json({ error: 'Editor role not configured' });
    if (password !== EDITOR_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  } else {
    return res.status(400).json({ error: 'Unknown role' });
  }

  const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, role });
});

app.get('/books', async (req, res) => {
  const rows = await db.all('SELECT * FROM books ORDER BY created_at DESC');
  const parsed = rows.map(r => ({
      ...r,
      authors: r.authors ? JSON.parse(r.authors) : [],
      categories: r.categories ? JSON.parse(r.categories) : (r.category ? [r.category] : [])
  }));
  res.json(parsed);
});

app.post('/books/:id/view', async (req,res) => {
  const id = req.params.id;
  await db.run('UPDATE books SET views = COALESCE(views,0) + 1 WHERE id = ?', [id]);
  res.json({ ok: true });
});

app.get('/stats/top', async (req,res) => {
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '10',10)));
  const rows = await db.all('SELECT * FROM books ORDER BY views DESC, updated_at DESC LIMIT ?', [limit]);
  const parsed = rows.map(r => ({ 
    ...r, 
    authors: r.authors ? JSON.parse(r.authors) : [],
    categories: r.categories ? JSON.parse(r.categories) : (r.category ? [r.category] : [])
  }));
  res.json(parsed);
});

// ISBN lookup
app.get('/isbn/:isbn', async (req, res) => {
  const isbnRaw = (req.params.isbn || '').replace(/[^0-9Xx]/g, '');
  if (!isbnRaw) return res.status(400).json({ error: 'invalid isbn' });

  try {
    const olRes = await fetch(`https://openlibrary.org/isbn/${isbnRaw}.json`);
    if (olRes.ok) {
      const ol = await olRes.json();
      let authors = [];
      if (Array.isArray(ol.authors)) {
        const names = await Promise.all(
          ol.authors.map(async (a) => {
            try {
              const r = await fetch(`https://openlibrary.org${a.key}.json`);
              if (r.ok) {
                const j = await r.json();
                return j.name;
              }
            } catch (e) {}
            return null;
          })
        );
        authors = names.filter(Boolean);
      }
      const cover = ol.covers && ol.covers.length
        ? `https://covers.openlibrary.org/b/id/${ol.covers[0]}-L.jpg`
        : '';
      const result = {
        title: ol.title || '',
        authors,
        description: typeof ol.description === 'string' ? ol.description : (ol.description?.value || ''),
        category: Array.isArray(ol.subjects) && ol.subjects.length ? ol.subjects[0] : '',
        categories: Array.isArray(ol.subjects) ? ol.subjects.slice(0, 3) : [],
        isbn: isbnRaw,
        cover,
        source: 'Open Library',
      };
      return res.json(result);
    }
  } catch (e) {}

  try {
    const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbnRaw}`);
    if (gRes.ok) {
      const g = await gRes.json();
      const item = g.items?.[0]?.volumeInfo;
      if (item) {
        return res.json({
          title: item.title || '',
          authors: item.authors || [],
          description: item.description || '',
          category: item.categories?.[0] || '',
          categories: item.categories || [],
          isbn: isbnRaw,
          cover: item.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
          source: 'Google Books',
        });
      }
    }
  } catch (e) {}

  res.status(404).json({ error: 'not found' });
});

// CRUD
app.post('/books', requireAuth, requireRole(['admin','editor']), async (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'title required' });
  const id = b.id || cryptoRandomId();
  const now = new Date().toISOString();
  const categories = Array.isArray(b.categories) ? b.categories.filter(Boolean) : [];
  const legacy = categories[0] || (b.category || '');

  const stmt = `INSERT INTO books (id,title,authors,category,categories,description,isbn,color1,color2,color3,cover,views,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  await db.run(stmt, [
    id,
    b.title,
    JSON.stringify(b.authors || []),
    legacy,
    JSON.stringify(categories),
    b.description || '',
    b.isbn || '',
    b.color1 || '',
    b.color2 || '',
    b.color3 || '',
    b.cover || '',
    0,
    now,
    now,
  ]);
  const created = await db.get('SELECT * FROM books WHERE id = ?', [id]);
  created.authors = created.authors ? JSON.parse(created.authors) : [];
  created.categories = created.categories ? JSON.parse(created.categories) : (created.category ? [created.category] : []);
  res.status(201).json(created);
});

app.put('/books/:id', requireAuth, requireRole(['admin','editor']), async (req, res) => {
  const id = req.params.id;
  const b = req.body || {};
  const now = new Date().toISOString();
  const categories = Array.isArray(b.categories) ? b.categories.filter(Boolean) : [];
  const legacy = categories[0] || (b.category || '');

  const stmt = `UPDATE books SET title=?, authors=?, category=?, categories=?, description=?, isbn=?, color1=?, color2=?, color3=?, cover=?, updated_at=? WHERE id=?`;
  await db.run(stmt, [
    b.title || '',
    JSON.stringify(b.authors || []),
    legacy,
    JSON.stringify(categories),
    b.description || '',
    b.isbn || '',
    b.color1 || '',
    b.color2 || '',
    b.color3 || '',
    b.cover || '',
    now,
    id,
  ]);
  const updated = await db.get('SELECT * FROM books WHERE id = ?', [id]);
  if (!updated) return res.status(404).json({ error: 'not found' });
  updated.authors = updated.authors ? JSON.parse(updated.authors) : [];
  updated.categories = updated.categories ? JSON.parse(updated.categories) : (updated.category ? [updated.category] : []);
  res.json(updated);
});

app.delete('/books/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const id = req.params.id;
  await db.run('DELETE FROM books WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Category metadata endpoints
app.get('/categories/meta', async (req,res) => {
  const books = await db.all('SELECT categories FROM books');
  const counts = new Map();
  for (const b of books){
    let cats = [];
    try { cats = JSON.parse(b.categories || '[]'); } catch(e){ cats = []; }
    cats.forEach(c => { if(!c) return; counts.set(c, (counts.get(c)||0)+1); });
  }
  const metas = await db.all('SELECT name, color FROM catmeta');
  const colorMap = new Map(metas.map(m => [m.name, m.color]));
  const out = [...counts.entries()].map(([name, count]) => ({ name, count, color: colorMap.get(name) || '' }))
                                   .sort((a,b)=>a.name.localeCompare(b.name));
  res.json(out);
});

app.post('/categories/color', requireAuth, requireRole(['admin']), async (req,res) => {
  const { name, color } = req.body || {};
  if(!name) return res.status(400).json({ error: 'name required' });
  await db.run('INSERT INTO catmeta(name,color) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET color=excluded.color', [name, color || '']);
  res.json({ ok: true });
});

app.post('/categories/rename', requireAuth, requireRole(['admin']), async (req,res) => {
  const { from, to } = req.body || {};
  if(!from || !to) return res.status(400).json({ error: 'from/to required' });
  const rows = await db.all('SELECT id, categories FROM books');
  let changed = 0;
  for (const r of rows){
    let cats = [];
    try { cats = JSON.parse(r.categories || '[]'); } catch(e){ cats = []; }
    const newCats = Array.from(new Set(cats.map(c=> c===from ? to : c))).filter(Boolean);
    if (JSON.stringify(newCats) !== JSON.stringify(cats)){
      const legacy = newCats[0] || '';
      await db.run('UPDATE books SET categories=?, category=? WHERE id=?', [JSON.stringify(newCats), legacy, r.id]);
      changed++;
    }
  }
  const meta = await db.get('SELECT color FROM catmeta WHERE name=?', [from]);
  if (meta){
    await db.run('INSERT INTO catmeta(name,color) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET color=excluded.color', [to, meta.color || '']);
    await db.run('DELETE FROM catmeta WHERE name=?', [from]);
  }
  res.json({ renamed: changed });
});

// Rec settings endpoints already above

// Seasonal recommendations (using settings)
app.get('/recommendations/seasonal', async (req,res) => {
  const cfg = await getRecSettingsObj();
  const seasonParam = (req.query.season || '').toLowerCase();
  const nowSeason = seasonParam || (function(d){ const m=d.getMonth()+1; if (m==12||m<=2) return 'winter'; if (m<=5) return 'fruehling'; if (m<=8) return 'sommer'; return 'herbst'; })(new Date());
  if (!cfg.enabled) return res.json({ season: nowSeason, items: [] });

  const keys = cfg.keywords[nowSeason] || [];
  const all = await db.all('SELECT * FROM books');
  const scored = [];
  for (const r of all){
    const cats = r.categories ? JSON.parse(r.categories||'[]') : (r.category ? [r.category] : []);
    const authors = r.authors ? JSON.parse(r.authors||'[]') : [];
    const hay = [r.title, authors.join(' '), r.description, ...cats].join(' ').toLowerCase();
    const kwScore = keys.reduce((s,k)=> s + (hay.includes(String(k).toLowerCase()) ? cfg.weightKeyword : 0), 0);
    const vScore = Math.min(r.views||0, 5) * cfg.weightView;
    const score = kwScore + vScore;
    if (score>0) scored.push({ r, score });
  }
  scored.sort((a,b)=> b.score - a.score);
  const pick = scored.slice(0, cfg.maxItems).map(x => ({
    ...x.r,
    authors: x.r.authors ? JSON.parse(x.r.authors) : [],
    categories: x.r.categories ? JSON.parse(x.r.categories) : (x.r.category ? [x.r.category] : [])
  }));
  res.json({ season: nowSeason, items: pick });
});

// CSV EXPORT (semicolon)
app.get('/export/csv', async (req, res) => {
  const rows = await db.all('SELECT * FROM books ORDER BY created_at DESC');
  const headers = ['id','title','authors','category','categories','description','isbn','color1','color2','color3','cover','views','created_at','updated_at'];
  const toCell = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/\r?\n/g, ' ').replace(/;/g, ','); 
    return `"${s.replace(/"/g,'""')}"`; 
  };
  const lines = [headers.join(';')];
  for(const r of rows){
    const cats = r.categories || (r.category ? JSON.stringify([r.category]) : '[]');
    const row = [
      r.id, r.title, r.authors || '[]', r.category || '', cats, r.description || '', r.isbn || '',
      r.color1 || '', r.color2 || '', r.cover || '', r.views || 0, r.created_at || '', r.updated_at || ''
    ].map(toCell).join(';');
    lines.push(row);
  }
  const csv = lines.join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="kita_books.csv"');
  res.send(csv);
});

// CSV IMPORT (Admin)
app.post('/import/csv', requireAuth, requireRole(['admin']), async (req, res) => {
  const text = req.body || '';
  if (typeof text !== 'string' || text.trim()==='') return res.status(400).json({ error: 'empty body' });
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if (lines.length < 2) return res.status(400).json({ error: 'no data' });
  const header = lines.shift();
  const cols = header.split(';').map(s=>s.trim());
  const expectAny = new Set(cols);
  const need = ['id','title','description','isbn','color1','color2','cover','views','created_at','updated_at']; // color3 optional
  for(const k of need){ if(!expectAny.has(k)) return res.status(400).json({ error: `missing column ${k}` }); }
  const hasCategory = expectAny.has('category');
  const hasCategories = expectAny.has('categories');
  const idx = Object.fromEntries(cols.map((k,i)=>[k,i]));

  const parseCell = (cell) => {
    let s = cell;
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1,-1).replace(/""/g,'"');
    return s;
  };

  let count = 0;
  for(const line of lines){
    const parts = [];
    let cur = '', inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur+='"'; i++; }
        else inQ = !inQ;
      } else if (ch === ';' && !inQ){
        parts.push(cur); cur='';
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    const obj = {};
    for(const k of cols){
      obj[k] = parseCell(parts[idx[k]] || '');
    }
    let authors = [];
    try { authors = JSON.parse(obj.authors || '[]'); } catch(e){ authors = (obj.authors||'').split(',').map(s=>s.trim()).filter(Boolean); }

    let cats = [];
    if (hasCategories) {
      try { cats = JSON.parse(obj.categories || '[]'); } catch(e){ cats = (obj.categories||'').split(',').map(s=>s.trim()).filter(Boolean); }
    } else if (hasCategory && obj.category) {
      cats = [obj.category];
    }
    const legacy = cats[0] || (hasCategory ? obj.category : '');

    const existing = await db.get('SELECT id FROM books WHERE id = ?', [obj.id]);
    if (existing){
      await db.run(`UPDATE books SET title=?, authors=?, category=?, categories=?, description=?, isbn=?, color1=?, color2=?, cover=?, views=?, updated_at=? WHERE id=?`, [
        obj.title, JSON.stringify(authors), legacy, JSON.stringify(cats), obj.description, obj.isbn, obj.color1, obj.color2, obj.cover, parseInt(obj.views||'0',10)||0, obj.updated_at || new Date().toISOString(), obj.id
      ]);
    } else {
      await db.run(`INSERT INTO books (id,title,authors,category,categories,description,isbn,color1,color2,cover,views,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        obj.id || cryptoRandomId(), obj.title, JSON.stringify(authors), legacy, JSON.stringify(cats), obj.description, obj.isbn, obj.color1, obj.color2, obj.cover, parseInt(obj.views||'0',10)||0, obj.created_at || new Date().toISOString(), obj.updated_at || new Date().toISOString()
      ]);
    }
    count++;
  }
  res.json({ imported: count });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

function cryptoRandomId() {
  return [...Array(16)].map(() => Math.floor(Math.random()*16).toString(16)).join('');
}

// ===== Recommendation settings (SQLite key-value) =====
async function initRecSettings(){
  await db.exec(`CREATE TABLE IF NOT EXISTS rec_settings (key TEXT PRIMARY KEY, value TEXT)`);
  const defaults = {
    enabled: '1',
    weightKeyword: '3',
    weightView: '1',
    maxItems: '12',
    keywords_winter: 'Winter,Schnee,Weihnachten,Nikolaus,Eis,Pinguin',
    keywords_fruehling: 'Frühling,Ostern,Blumen,Garten,Natur',
    keywords_sommer: 'Sommer,Baden,Meer,Reise,Sonne,Ferien',
    keywords_herbst: 'Herbst,Laterne,Sankt Martin,Ernte,Kürbis,Halloween'
  };
  for (const [k,v] of Object.entries(defaults)){
    const row = await db.get('SELECT value FROM rec_settings WHERE key=?', [k]);
    if (!row) await db.run('INSERT INTO rec_settings(key,value) VALUES(?,?)', [k, v]);
  }
}
initRecSettings().catch(console.error);

async function getRecSettingsObj(){
  const rows = await db.all('SELECT key, value FROM rec_settings');
  const m = {}; rows.forEach(r => m[r.key] = r.value);
  return {
    enabled: m.enabled === '1',
    weightKeyword: parseInt(m.weightKeyword||'3',10),
    weightView: parseInt(m.weightView||'1',10),
    maxItems: Math.max(1, Math.min(50, parseInt(m.maxItems||'12',10))),
    keywords: {
      winter: (m.keywords_winter||'').split(',').map(s=>s.trim()).filter(Boolean),
      fruehling: (m.keywords_fruehling||'').split(',').map(s=>s.trim()).filter(Boolean),
      sommer: (m.keywords_sommer||'').split(',').map(s=>s.trim()).filter(Boolean),
      herbst: (m.keywords_herbst||'').split(',').map(s=>s.trim()).filter(Boolean),
    }
  };
}

// GET/POST: /settings/recommendations
app.get('/settings/recommendations', async (req,res)=>{
  const s = await getRecSettingsObj();
  res.json(s);
});
app.post('/settings/recommendations', requireAuth, requireRole(['admin']), async (req,res)=>{
  const body = req.body || {};
  const updates = {};
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled ? '1' : '0';
  if (Number.isFinite(body.weightKeyword)) updates.weightKeyword = String(body.weightKeyword);
  if (Number.isFinite(body.weightView)) updates.weightView = String(body.weightView);
  if (Number.isFinite(body.maxItems)) updates.maxItems = String(body.maxItems);
  if (body.keywords && typeof body.keywords === 'object'){
    if (Array.isArray(body.keywords.winter)) updates.keywords_winter = body.keywords.winter.join(', ');
    if (Array.isArray(body.keywords.fruehling)) updates.keywords_fruehling = body.keywords.fruehling.join(', ');
    if (Array.isArray(body.keywords.sommer)) updates.keywords_sommer = body.keywords.sommer.join(', ');
    if (Array.isArray(body.keywords.herbst)) updates.keywords_herbst = body.keywords.herbst.join(', ');
  }
  for (const [k,v] of Object.entries(updates)){
    await db.run('INSERT INTO rec_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, v]);
  }
  const s = await getRecSettingsObj();
  res.json(s);
});


// --- Reverse Lookup: Titel -> Kandidaten (Open Library + Google Books optional) ---
app.get('/search/title', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'query required' });

  const candidates = [];

  async function pushOpenLibrary(url){
    const r = await fetch(url);
    if (!r.ok) return;
    const j = await r.json();
    if (!Array.isArray(j.docs)) return;
    for (const d of j.docs) {
      const title = d.title || '';
      const authors = Array.isArray(d.author_name) ? d.author_name : [];
      const isbn = Array.isArray(d.isbn) ? d.isbn[0] : '';
      const cover = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '';
      candidates.push({ source: 'openlibrary', title, authors, description: '', isbn, cover });
    }
  }

  try {
    await pushOpenLibrary(`https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=10`);
    if (candidates.length < 5) await pushOpenLibrary(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`);
    if (candidates.length < 5) await pushOpenLibrary(`https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&language=deu&limit=10`);
  } catch (e) {}

  try {
    const key = process.env.GOOGLE_BOOKS_KEY || '';
    const url1 = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&maxResults=10&langRestrict=de${key ? `&key=${key}` : ''}`;
    const url2 = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10${key ? `&key=${key}` : ''}`;
    for (const url of [url1, url2]) {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j.items)) continue;
      for (const it of j.items) {
        const info = it.volumeInfo || {};
        const title = info.title || '';
        const authors = Array.isArray(info.authors) ? info.authors : [];
        const description = info.description || '';
        let isbn = '';
        if (Array.isArray(info.industryIdentifiers)) {
          const id13 = info.industryIdentifiers.find(x => x.type === 'ISBN_13');
          const id10 = info.industryIdentifiers.find(x => x.type === 'ISBN_10');
          isbn = (id13?.identifier || id10?.identifier || '');
        }
        const cover = (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '').replace('http://','https://');
        candidates.push({ source:'google', title, authors, description, isbn, cover });
      }
    }
  } catch (e) {}

  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const k = (c.title + '|' + (c.authors||[]).join(',')).toLowerCase();
    if (!seen.has(k)) { seen.add(k); uniq.push(c); }
  }
  res.json({ query: q, items: uniq.slice(0, 20) });
});

// --- Metadaten anwenden auf ein Buch ---
app.post('/books/:id/metadata', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
  const id = req.params.id;
  const book = await db.get('SELECT * FROM books WHERE id = ?', [id]);
  if (!book) return res.status(404).json({ error:'not found' });
  const b = req.body || {};
  const now = new Date().toISOString();

  const authors = Array.isArray(b.authors) ? b.authors : (book.authors ? JSON.parse(book.authors) : []);
  const description = typeof b.description === 'string' ? b.description : (book.description || '');
  const isbn = typeof b.isbn === 'string' ? b.isbn : (book.isbn || '');
  const cover = typeof b.cover === 'string' ? b.cover : (book.cover || '');

  await db.run(
    `UPDATE books SET authors=?, description=?, isbn=?, cover=?, updated_at=? WHERE id=?`,
    [JSON.stringify(authors), description, isbn, cover, now, id]
  );
  const updated = await db.get('SELECT * FROM books WHERE id = ?', [id]);
  updated.authors = updated.authors ? JSON.parse(updated.authors) : [];
  res.json(updated);
});

// --- Bulk-Enrichment fehlender Metadaten ---

// Bulk set/clear colors 1..3
app.post('/books/bulk/colors', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
  const { ids=[], color1, color2, color3 } = req.body || {};
  if (!Array.isArray(ids) || ids.length===0) return res.status(400).json({ error: 'ids required' });
  const allowed = {};
  if (typeof color1 !== 'undefined') allowed.color1 = color1;
  if (typeof color2 !== 'undefined') allowed.color2 = color2;
  if (typeof color3 !== 'undefined') allowed.color3 = color3;
  if (Object.keys(allowed).length===0) return res.status(400).json({ error: 'no changes' });
  const sets = Object.keys(allowed).map(k=>`${k} = ${allowed[k]===null?'NULL':'?'}`).join(', ');
  const paramsBase = Object.values(allowed).filter(v=>v!==null);
  let count = 0;
  for (const id of ids){
    const params = [...paramsBase];
    await db.run(`UPDATE books SET ${sets} WHERE id = ?`, [...params, id]);
    count++;
  }
  res.json({ updated: count });


// Bulk categories: add/remove or replace set
app.post('/books/bulk/categories', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
  const { ids=[], add=[], remove=[], set=null } = req.body || {};
  if (!Array.isArray(ids) || ids.length===0) return res.status(400).json({ error: 'ids required' });
  // normalize inputs
  const addList = Array.isArray(add) ? add.filter(Boolean) : [];
  const removeList = Array.isArray(remove) ? remove.filter(Boolean) : [];
  const setList = Array.isArray(set) ? set.filter(Boolean) : null;

  let updated = 0;
  for (const id of ids){
    const row = await db.get('SELECT id, category, categories FROM books WHERE id = ?', [id]);
    if (!row) continue;
    let cats = [];
    try { cats = row.categories ? JSON.parse(row.categories) : (row.category ? [row.category] : []); } catch(e){ cats = []; }
    if (setList){
      cats = [...new Set(setList)];
    } else {
      if (addList.length) cats = [...new Set([...cats, ...addList])];
      if (removeList.length) cats = cats.filter(c => !removeList.includes(c));
    }
    const legacy = cats[0] || '';
    await db.run('UPDATE books SET categories=?, category=?, updated_at=? WHERE id=?', [JSON.stringify(cats), legacy, new Date().toISOString(), id]);
    updated++;
  }
  res.json({ updated });
});

});

app.post('/enrich/missing', requireAuth, requireRole(['admin']), async (req,res)=>{
  const dry = (String(req.query.dry||'1') === '1');
  const rows = await db.all('SELECT * FROM books');
  const changed = [];

  for (const r of rows) {
    const needs = !(r.authors && r.authors !== '[]') || !r.description || !r.cover;
    if (!needs || !r.title) continue;
    try {
      const proto = (req.headers['x-forwarded-proto'] || req.protocol);
      const host = req.get('host');
      const url = `${proto}://${host}/api/search/title?q=${encodeURIComponent(r.title)}`;
      const found = await fetch(url);
      if (!found.ok) continue;
      const j = await found.json();
      if (!Array.isArray(j.items) || j.items.length===0) continue;

      const lc = r.title.toLowerCase();
      const exact = j.items.find(x => (x.title||'').toLowerCase() === lc);
      const pick = exact || j.items[0];

      if (!dry) {
        await db.run(
          `UPDATE books SET authors=?, description=?, isbn=?, cover=?, updated_at=? WHERE id=?`,
          [
            JSON.stringify(pick.authors || []),
            pick.description || r.description || '',
            pick.isbn || r.isbn || '',
            pick.cover || r.cover || '',
            new Date().toISOString(),
            r.id
          ]
        );
      }
      changed.push({ id: r.id, title: r.title, applied: !dry, pick });
    } catch(e) {}
  }
  res.json({ dry, count: changed.length, items: changed });
});
