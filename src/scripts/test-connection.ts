import 'dotenv/config';
import { connectDatabase, disconnectDatabase, User, Project } from '../index.js';

async function testConnection() {
  console.log('🔌 Connecting to MongoDB...');
  console.log(`   URI: ${process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@')}`);

  try {
    await connectDatabase();
    console.log('✅ Connected successfully!\n');

    // Test: List collections
    const { mongoose } = await import('../config/database.js');
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log('📁 Collections:', collections?.map((c) => c.name) || []);

    // Test: Count documents
    const userCount = await User.countDocuments();
    const projectCount = await Project.countDocuments();
    console.log(`👤 Users: ${userCount}`);
    console.log(`📋 Projects: ${projectCount}`);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

testConnection();
