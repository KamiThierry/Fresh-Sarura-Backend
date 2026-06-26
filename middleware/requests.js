import logger from '../utils/logger.js';

// Request logging middleware
export const requestLogger = (req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
};

// Response time middleware
export const responseTime = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

export default {
  requestLogger,
  responseTime,
};
