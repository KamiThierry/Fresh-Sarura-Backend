import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Get health status of the API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getHealth = (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMessage = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    }[dbStatus];

    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatusMessage,
        connected: dbStatus === 1,
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    const statusCode = dbStatus === 1 ? 200 : 503;
    res.status(statusCode).json(healthStatus);

    logger.info(`Health check performed - Database: ${dbStatusMessage}`);
  } catch (error) {
    logger.error('Health check error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error.message,
    });
  }
};

/**
 * Get detailed health information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDetailedHealth = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const db = mongoose.connection.getClient();

    const detailedHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      server: {
        version: process.env.API_VERSION || 'v1',
        nodeVersion: process.version,
      },
      database: {
        status: dbStatus === 1 ? 'connected' : 'disconnected',
        connected: dbStatus === 1,
        provider: 'MongoDB',
      },
      system: {
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };

    res.status(200).json(detailedHealth);
    logger.info('Detailed health check performed');
  } catch (error) {
    logger.error('Detailed health check error:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: 'Detailed health check failed',
      error: error.message,
    });
  }
};

export default {
  getHealth,
  getDetailedHealth,
};
