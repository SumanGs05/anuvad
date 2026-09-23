const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  return next();
}

module.exports = { requireAuth };
