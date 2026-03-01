const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
router.get('/categories/meta', async (req,res) => {
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
router.post('/categories/color', requireAuth, requireRole(['admin']), async (req,res) => {
  const { name, color } = req.body || {};
  if(!name) return res.status(400).json({ error: 'name required' });
  await db.run('INSERT INTO catmeta(name,color) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET color=excluded.color', [name, color || '']);
  res.json({ ok: true });
});
router.post('/categories/rename', requireAuth, requireRole(['admin']), async (req,res) => {
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
module.exports = router;
