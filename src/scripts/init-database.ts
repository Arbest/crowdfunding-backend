import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../index.js';
import { User, Session, Project, Contribution, PaymentEvent, AuditLog } from '../models/index.js';
import { mongoose } from '../config/database.js';

async function initDatabase() {
  console.log('🔌 Connecting to MongoDB...');

  try {
    await connectDatabase();
    console.log('✅ Connected!\n');

    // Drop all existing collections
    console.log('🗑️  Dropping existing collections...');
    const collections = await mongoose.connection.db?.listCollections().toArray();
    for (const col of collections || []) {
      await mongoose.connection.db?.dropCollection(col.name);
      console.log(`   Dropped: ${col.name}`);
    }

    // Recreate collections with indexes by calling createIndexes on each model
    console.log('\n📁 Creating collections with indexes...');

    await User.createCollection();
    await User.createIndexes();
    console.log('   ✅ users');

    await Session.createCollection();
    await Session.createIndexes();
    console.log('   ✅ sessions');

    await Project.createCollection();
    await Project.createIndexes();
    console.log('   ✅ projects');

    await Contribution.createCollection();
    await Contribution.createIndexes();
    console.log('   ✅ contributions');

    await PaymentEvent.createCollection();
    await PaymentEvent.createIndexes();
    console.log('   ✅ paymentEvents');

    await AuditLog.createCollection();
    await AuditLog.createIndexes();
    console.log('   ✅ auditLogs');

    // List final state
    console.log('\n📊 Final database state:');
    const finalCollections = await mongoose.connection.db?.listCollections().toArray();
    for (const col of finalCollections || []) {
      const indexes = await mongoose.connection.db?.collection(col.name).indexes();
      console.log(`\n   ${col.name}:`);
      for (const idx of indexes || []) {
        console.log(`      - ${idx.name}: ${JSON.stringify(idx.key)}`);
      }
    }

    console.log('\n✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

initDatabase();
