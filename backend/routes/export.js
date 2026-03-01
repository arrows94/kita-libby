const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cryptoRandomId } = require('../utils');
router.get('/export/csv', async (req, res) => {
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
router.post('/import/csv', requireAuth, requireRole(['admin']), async (req, res) => {
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
module.exports = router;
