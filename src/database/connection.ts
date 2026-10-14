import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('database');

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => log.warn('Disconnected from MongoDB'));
  mongoose.connection.on('reconnected', () => log.info('Reconnected to MongoDB'));
  mongoose.connection.on('error', (error) => log.error('MongoDB error', error));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  log.info(`Connected to MongoDB (${env.MONGODB_DB_NAME})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
