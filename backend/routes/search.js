const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
router.get('/search/title', async (req, res) => {
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
router.post('/enrich/missing', requireAuth, requireRole(['admin']), async (req,res)=>{
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
module.exports = router;
