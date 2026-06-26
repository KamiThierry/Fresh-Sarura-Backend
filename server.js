import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config/environment.js';
import { connectDB } from './config/database.js';
import morganMiddleware from './middleware/logger.js';
import { requestLogger, responseTime } from './middleware/requests.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import logger from './utils/logger.js';

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// ============================================
// PARSING MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// COMPRESSION MIDDLEWARE
// ============================================
app.use(compression());

// ============================================
// LOGGING MIDDLEWARE
// ============================================
app.use(morganMiddleware);
app.use(requestLogger);
app.use(responseTime);

// ============================================
// APPLICATION ROUTES
// ============================================
app.use(routes);

// ============================================
// ERROR HANDLING
// ============================================
app.use(notFound);
app.use(errorHandler);

// ============================================
// DATABASE CONNECTION
// ============================================
await connectDB();

// ============================================
// SERVER START
// ============================================
const PORT = config.port;

const server = app.listen(PORT, () => {
  const dbStatus = mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected';
  logger.info(`
    ====================================
    🚀 Server is running!
    ====================================
    📍 Environment: ${config.env}
    🔌 Port: ${PORT}
    🗄️  Database: ${dbStatus}
    ====================================
  `);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ============================================
// UNHANDLED REJECTION & EXCEPTIONS
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
