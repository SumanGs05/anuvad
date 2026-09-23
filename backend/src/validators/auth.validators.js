const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().trim().email('A valid email is required').max(254),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(72, 'Password must not exceed 72 characters'),
  name: z.string().trim().max(120).optional().default('')
});

const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required').max(254),
  password: z.string().min(1, 'Password is required').max(72)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'A valid refresh token is required')
});

const logoutSchema = z.object({
  refreshToken: z.string().min(10, 'A valid refresh token is required')
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
