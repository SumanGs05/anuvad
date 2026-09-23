const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/tokens');
const logger = require('../utils/logger');

// Maximum number of concurrent refresh tokens (sessions) per user.
const MAX_REFRESH_HASHES = 5;

// Pre-computed dummy hash used to normalize timing when an account does not
// exist. bcrypt.compare always takes ~constant time for a given cost factor,
// so this prevents email enumeration via response timing.
// Value is bcrypt(cost=12) of a nonsense string; the plaintext does not matter.
let DUMMY_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
// Refresh the dummy hash asynchronously at startup (makes it unpredictable).
bcrypt.hash('___anuvad_dummy___', 12).then((h) => { DUMMY_HASH = h; }).catch(() => {});

function publicUser(user) {
  return { id: user._id, email: user.email, name: user.name };
}

async function issueTokens(user) {
  const refreshToken = signRefreshToken(user);
  const hash = hashToken(refreshToken);

  // Cap stored sessions to MAX_REFRESH_HASHES (evict oldest).
  user.refreshTokenHashes.push(hash);
  if (user.refreshTokenHashes.length > MAX_REFRESH_HASHES) {
    user.refreshTokenHashes = user.refreshTokenHashes.slice(-MAX_REFRESH_HASHES);
  }

  await user.save();
  return { accessToken: signAccessToken(user), refreshToken };
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

async function register(req, res) {
  const env = require('../config/env');
  if (!env.registrationEnabled) {
    return res.status(403).json({ error: 'New registrations are currently closed.' });
  }

  const { email, password, name } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ email, passwordHash, name });

  await AuditLog.create({
    user: user._id,
    action: 'user.register',
    ipAddress: clientIp(req),
    metadata: {}
  }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  const tokens = await issueTokens(user);
  return res.status(201).json({ user: publicUser(user), ...tokens });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHashes');

  if (!user) {
    // Dummy compare to normalise timing and prevent email enumeration.
    await bcrypt.compare(password, DUMMY_HASH);

    await AuditLog.create({
      action: 'user.login_failed',
      ipAddress: clientIp(req),
      metadata: {}
    }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    await AuditLog.create({
      user: user._id,
      action: 'user.login_failed',
      ipAddress: clientIp(req),
      metadata: {}
    }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await AuditLog.create({
    user: user._id,
    action: 'user.login',
    ipAddress: clientIp(req),
    metadata: {}
  }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  const tokens = await issueTokens(user);
  return res.json({ user: publicUser(user), ...tokens });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHashes');
  const tokenHash = hashToken(refreshToken);
  if (!user || !user.refreshTokenHashes.includes(tokenHash)) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Rotate: remove used hash, issue new pair.
  user.refreshTokenHashes = user.refreshTokenHashes.filter((h) => h !== tokenHash);

  await AuditLog.create({
    user: user._id,
    action: 'user.token_refresh',
    ipAddress: clientIp(req),
    metadata: {}
  }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));

  const tokens = await issueTokens(user);
  return res.json({ ...tokens });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_err) {
    // Even if token is invalid/expired, return 200 - logout should always succeed.
    return res.status(200).json({ message: 'Logged out' });
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHashes');
  if (user) {
    const tokenHash = hashToken(refreshToken);
    user.refreshTokenHashes = user.refreshTokenHashes.filter((h) => h !== tokenHash);
    await user.save();

    await AuditLog.create({
      user: user._id,
      action: 'user.logout',
      ipAddress: clientIp(req),
      metadata: {}
    }).catch((err) => logger.warn('AuditLog write failed', { error: err.message }));
  }

  return res.status(200).json({ message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };
