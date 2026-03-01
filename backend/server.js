require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRouter = require('./routes/auth');
const booksRouter = require('./routes/books');
const categoriesRouter = require('./routes/categories');
const exportRouter = require('./routes/export');
const searchRouter = require('./routes/search');
const settingsRouter = require('./routes/settings');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '2mb' }));
app.use(express.text({ type: ['text/*','application/csv'], limit: '5mb' }));
app.use(cors({ origin: true, credentials: true }));

// --- DB init + migration ---
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

// --- Routes ---
app.use('/', authRouter);
app.use('/', booksRouter);
app.use('/', categoriesRouter);
app.use('/', exportRouter);
app.use('/', searchRouter);
app.use('/', settingsRouter);
app.use('/', statsRouter);

app.listen(PORT, () => console.log(`Backend läuft auf http://localhost:${PORT}`));
