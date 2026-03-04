const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || ''; // optional

router.post('/login', (req, res) => {
  let { password, role } = req.body || {};
  role = role || 'admin';
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (role === 'admin') {
    if (!ADMIN_PASSWORD) return res.status(401).json({ error: 'Admin login disabled: Password not configured' });
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
module.exports = router;
