// Global error handling middleware for Express

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  // Log the error (will be replaced by structured logger in production)
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack || err.message);
  } else {
    console.warn(`[WARN] ${req.method} ${req.path}: ${err.message}`);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { detail: err.message } : {}),
  });
}

// Wrap async route handlers to catch promise rejections
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
