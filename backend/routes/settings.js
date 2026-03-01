const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

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
router.get('/settings/recommendations', async (req,res)=>{
  const s = await getRecSettingsObj();
  res.json(s);
});
router.post('/settings/recommendations', requireAuth, requireRole(['admin']), async (req,res)=>{
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
module.exports = router;
module.exports.getRecSettingsObj = getRecSettingsObj;
