const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cryptoRandomId } = require('../utils');

const dataDir = process.env.DB_FILE ? path.dirname(process.env.DB_FILE) : path.join(__dirname, '../../data');
const coversDir = path.join(dataDir, 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, coversDir);
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      if (file.mimetype.includes('image/png')) ext = '.png';
      else if (file.mimetype.includes('image/webp')) ext = '.webp';
      else ext = '.jpg';
    }
    const uniqueName = cryptoRandomId() + ext;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Nur Bilder sind erlaubt.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

router.post('/covers/upload', requireAuth, requireRole(['admin', 'editor']), upload.single('cover'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const localUrl = `/api/covers/${req.file.filename}`;
  res.json({ url: localUrl });
});

module.exports = router;
