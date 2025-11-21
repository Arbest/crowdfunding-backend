import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crowdfunding';

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
}

let isConnected = false;

export async function connectDatabase(options: ConnectionOptions = {}): Promise<typeof mongoose> {
  const { maxRetries = 5, retryDelay = 5000 } = options;

  if (isConnected) {
    console.log('Using existing database connection');
    return mongoose;
  }

  let retries = 0;

  while (retries < maxRetries) {
    try {
      const connection = await mongoose.connect(MONGODB_URI);
      isConnected = true;
      console.log('MongoDB connected successfully');

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        isConnected = false;
      });

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      return connection;
    } catch (error) {
      retries++;
      console.error(`MongoDB connection attempt ${retries}/${maxRetries} failed:`, error);

      if (retries >= maxRetries) {
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Failed to connect to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
  console.log('MongoDB disconnected');
}

export function getConnectionStatus(): boolean {
  return isConnected;
}

export { mongoose };
