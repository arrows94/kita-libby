const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cryptoRandomId } = require('../utils');

router.get('/books', async (req, res) => {
  const rows = await db.all('SELECT * FROM books ORDER BY created_at DESC');
  const parsed = rows.map(r => ({
      ...r,
      authors: r.authors ? JSON.parse(r.authors) : [],
      categories: r.categories ? JSON.parse(r.categories) : (r.category ? [r.category] : [])
  }));
  res.json(parsed);
});

router.post('/books/:id/view', async (req,res) => {
  const id = req.params.id;
  await db.run('UPDATE books SET views = COALESCE(views,0) + 1 WHERE id = ?', [id]);
  res.json({ ok: true });
});

// ISBN lookup
router.get('/isbn/:isbn', async (req, res) => {
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
router.post('/books', requireAuth, requireRole(['admin','editor']), async (req, res) => {
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

router.put('/books/:id', requireAuth, requireRole(['admin','editor']), async (req, res) => {
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

router.delete('/books/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const id = req.params.id;
  await db.run('DELETE FROM books WHERE id = ?', [id]);
  res.json({ ok: true });
});

// --- Metadaten anwenden auf ein Buch ---
router.post('/books/:id/metadata', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
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

// Bulk set/clear colors 1..3
router.post('/books/bulk/colors', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
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
});

// Bulk categories: add/remove or replace set
router.post('/books/bulk/categories', requireAuth, requireRole(['admin','editor']), async (req,res)=>{
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

module.exports = router;
