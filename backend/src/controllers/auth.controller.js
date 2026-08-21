const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/tokens');

function publicUser(user) {
  return { id: user._id, email: user.email, name: user.name };
}

async function issueTokens(user) {
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHashes.push(hashToken(refreshToken));
  await user.save();
  return { accessToken: signAccessToken(user), refreshToken };
}

async function register(req, res) {
  const { email, password, name } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ email, passwordHash, name });
  const tokens = await issueTokens(user);
  return res.status(201).json({ user: publicUser(user), ...tokens });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHashes');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
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

  user.refreshTokenHashes = user.refreshTokenHashes.filter((hash) => hash !== tokenHash);
  const tokens = await issueTokens(user);
  return res.json({ ...tokens });
}

module.exports = { register, login, refresh };
