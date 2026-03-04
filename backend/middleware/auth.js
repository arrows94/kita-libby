const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret-change-me' : undefined);

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

module.exports = {
  requireAuth,
  requireRole,
  JWT_SECRET
};
