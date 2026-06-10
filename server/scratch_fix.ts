import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Meeting from './src/models/Meeting';
import User from './src/models/User';
import { getMom } from './src/controllers/momController';

dotenv.config({ path: '.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI || '');
  console.log('Connected');
  
  const req = { params: { id: '6a290a8f4ad877f61e13a402' }, user: { id: '6a15507e7a8ea6b9ea95e6a0', role: 'SuperAdmin' } };
  const res = { 
    json: (data: any) => console.log('Response:', data),
    status: (code: number) => { console.log('Status code:', code); return res; }
  };

  await getMom(req as any, res as any);
  process.exit();
}

run().catch(console.error);
