import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from '../config/database.js';

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
