import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected to Atlas');
  } catch (err) {
    console.warn('MongoDB Atlas connection failed. Attempting to start in-memory MongoDB server...');
    try {
      process.env.MONGOMS_DOWNLOAD_BYPASS_MD5 = 'true';
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '4.4.24',
        }
      });
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('MongoDB connected to in-memory server:', mongoUri);
      
      // Auto-seed SuperAdmin
      await seedSuperAdmin();
    } catch (memErr) {
      console.error('Failed to start in-memory MongoDB server:', memErr);
      process.exit(1);
    }
  }
};

const seedSuperAdmin = async () => {
  try {
    const User = require('../models/User').default;
    const { Role } = require('../models/User');
    const email = process.env.FIRST_SUPERADMIN_EMAIL;
    if (!email) {
      console.warn('FIRST_SUPERADMIN_EMAIL not set in .env. Skipping auto-seed.');
      return;
    }
    const exists = await User.findOne({ email });
    if (!exists) {
      await User.create({
        name: 'Super Admin',
        email,
        role: Role.SuperAdmin,
        isActive: true,
      });
      console.log(`Auto-seeded SuperAdmin for ${email}`);
    } else {
      console.log(`SuperAdmin for ${email} already exists.`);
    }

    // Seed Dummy Users for Frontend Testing
    const dummyUsers = [
      { _id: '65f0a1b2c3d4e5f607890ab1', name: 'Alice Smith', email: 'alice@example.com', role: Role.Member },
      { _id: '65f0a1b2c3d4e5f607890ab2', name: 'Bob Johnson', email: 'bob@example.com', role: Role.Member },
      { _id: '65f0a1b2c3d4e5f607890ab3', name: 'Charlie Brown', email: 'charlie@example.com', role: Role.Member },
      { _id: '65f0a1b2c3d4e5f607890ab4', name: 'Diana Prince', email: 'diana@example.com', role: Role.Member },
    ];
    
    for (const u of dummyUsers) {
      const uExists = await User.findById(u._id);
      if (!uExists) {
        await User.create(u);
      }
    }
    console.log('Auto-seeded Dummy Users for frontend testing');
  } catch (seedErr) {
    console.error('Error auto-seeding SuperAdmin:', seedErr);
  }
};