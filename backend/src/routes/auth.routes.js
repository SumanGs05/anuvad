const express = require('express');
const validate = require('../middleware/validate');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');
const { registerSchema, loginSchema, refreshSchema, logoutSchema } = require('../validators/auth.validators');
const controller = require('../controllers/auth.controller');

const router = express.Router();
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), controller.refresh);
router.post('/logout', refreshLimiter, validate(logoutSchema), controller.logout);
module.exports = router;
