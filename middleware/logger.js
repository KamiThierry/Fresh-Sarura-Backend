import morgan from 'morgan';
import logger from '../utils/logger.js';

// Custom morgan stream
const stream = {
  write: (message) => logger.http(message),
};

// Morgan middleware configuration
const morganMiddleware = morgan(
  ':remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms',
  { stream }
);

export default morganMiddleware;
