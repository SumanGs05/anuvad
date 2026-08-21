const express = require('express');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { registerSchema, loginSchema, refreshSchema } = require('../validators/auth.validators');
const controller = require('../controllers/auth.controller');

const router = express.Router();
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', authLimiter, validate(refreshSchema), controller.refresh);
module.exports = router;
