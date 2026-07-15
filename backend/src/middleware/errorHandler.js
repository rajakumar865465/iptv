const errorHandler = (err, req, res, next) => {
  // Only log full stack trace for 500 internal errors
  if (!err.status || err.status === 500) {
    if (err.code !== 'ECONNREFUSED' && err.code !== 'ETIMEDOUT') {
      console.error(err.stack || err.message);
    } else {
      console.error(`[Network Error] ${err.message}`);
    }
  } else {
    console.error(`[Error ${err.status}] ${err.message}`);
  }

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry found',
      errors: [err.detail],
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Handle DB connection issues cleanly
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.message?.includes('socket') || err.message?.includes('timeout') || err.message?.includes('Connection terminated')) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
