const express = require('express');
const router = express.Router();
const db = require('../db');
const { getRecSettingsObj } = require('./settings');
router.get('/stats/top', async (req,res) => {
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '10',10)));
  const rows = await db.all('SELECT * FROM books ORDER BY views DESC, updated_at DESC LIMIT ?', [limit]);
  const parsed = rows.map(r => ({
    ...r,
    authors: r.authors ? JSON.parse(r.authors) : [],
    categories: r.categories ? JSON.parse(r.categories) : (r.category ? [r.category] : [])
  }));
  res.json(parsed);
});
router.get('/recommendations/seasonal', async (req,res) => {
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
module.exports = router;
