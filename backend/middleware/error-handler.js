// Global error handling middleware for Express

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  // Use pino logger if available on the request (via pino-http), otherwise console
  const log = req.log || console;
  if (status >= 500) {
    log.error({ err, method: req.method, path: req.path }, 'Server error');
  } else {
    log.warn({ status, method: req.method, path: req.path }, err.message);
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
