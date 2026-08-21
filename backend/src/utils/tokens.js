const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn
  });
}

function signRefreshToken(user) {
  // A random jti ensures refresh tokens are unique even if issued in the
  // same second, and lets us store/compare only a hash server-side.
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user._id.toString(), jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn
  });
  return token;
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken
};
