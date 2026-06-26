import mongoose from 'mongoose';
import config from './environment.js';
import logger from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const mongoUri = config.mongodb.uri;
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    logger.error('❌ MongoDB Connection Failed!');
    logger.error(`Error Name: ${error.name}`);
    logger.error(`Error Message: ${error.message}`);
    
    // Check for common Atlas issues
    if (error.message.includes('MongooseServerSelectionError')) {
      logger.warn('Hint: This often means your IP address is not whitelisted in MongoDB Atlas or the database is down.');
    }
    
    if (config.isProduction) {
      process.exit(1);
    }
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error.message);
  }
};

// Connection event listeners
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error:', error.message);
});

export default mongoose;
