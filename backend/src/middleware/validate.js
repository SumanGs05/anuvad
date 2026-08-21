/**
 * Generic Zod-based request validation middleware. Rejects malformed
 * requests with a 400 before they reach any business logic, and never
 * leaks internal validation implementation details beyond field-level
 * messages.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));
      return res.status(400).json({ error: 'Validation failed', details: issues });
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = validate;
