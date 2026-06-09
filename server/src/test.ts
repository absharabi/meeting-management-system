import mongoose from 'mongoose';
import 'dotenv/config';
import Meeting from './models/Meeting';
import User from './models/User';

mongoose.connect(process.env.MONGO_URI as string).then(async () => {
  // initialize User
  User.find().limit(1);
  const requestingUser = { id: '6a15507e7a8ea6b9ea95e6a0', role: 'User' };
  let query: any = {};
  
  const accessFilter = {
    $or: [
      { organizerId: requestingUser.id },
      { 'participants.user': requestingUser.id },
      { visibility: 'Public' }
    ]
  };
  query.$or = accessFilter.$or;
  
  console.log('QUERY:', JSON.stringify(query));
  
  const meetings = await Meeting.find(query)
      .populate('organizerId', 'name email')
      .populate('participants.user', 'name email department')
      .populate('attendance', 'name email')
      .sort({ date: 1, startTime: 1 });
      
  console.log('MATCHED:', meetings.length);
  process.exit(0);
});
