import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isDevelopment = nodeEnv === 'development';
const isProduction = nodeEnv === 'production';

export const config = {
  env: nodeEnv,
  isDevelopment,
  isProduction,
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/garden_api',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  api: {
    version: process.env.API_VERSION || 'v1',
  },
};

export default config;
