import 'dotenv/config';
import mongoose from 'mongoose';
import User, { Role } from './src/models/User';

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected to MongoDB');

  const email = process.env.FIRST_SUPERADMIN_EMAIL;
  if (!email) {
    console.error('Set FIRST_SUPERADMIN_EMAIL in your .env file');
    process.exit(1);
  }

  const exists = await User.findOne({ email });
  if (exists) {
    console.log(`User ${email} already exists with role: ${exists.role}`);
    process.exit(0);
  }

  await User.create({
    name:     'Super Admin',
    email,
    role:     Role.SuperAdmin,
    isActive: true,
  });

  console.log(`SuperAdmin created for ${email}`);
  process.exit(0);
};

seed().catch(err => {
  console.error(err);
  process.exit(1);
});