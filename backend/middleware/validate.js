// Input validation and sanitization middleware

// Sanitize a string: trim, remove null bytes, limit length
function sanitize(value, maxLength = 1000) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\0/g, '').substring(0, maxLength);
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate date format (YYYY-MM-DD)
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// Validate that a value is a positive integer
function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

// Validate ID parameters are integers (prevents SQL injection via params)
function validateIdParams(req, res, next) {
  for (const [key, value] of Object.entries(req.params)) {
    if (key === 'id' || key.endsWith('Id')) {
      if (!/^\d+$/.test(value)) {
        return res.status(400).json({ error: `Invalid ${key}: must be a numeric ID` });
      }
    }
  }
  next();
}

// Sanitize all string fields in request body
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitize(value);
      }
    }
  }
  next();
}

module.exports = {
  sanitize,
  isValidEmail,
  isValidDate,
  isPositiveInt,
  validateIdParams,
  sanitizeBody,
};
