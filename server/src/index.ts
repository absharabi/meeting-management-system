import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import meetingRoutes from './routes/meeting.routes';
import momRoutes from './routes/mom';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/report.routes';
import feedbackRoutes from './routes/feedback.routes';
import actionItemRoutes from './routes/actionItem.routes';
import uploadRoutes from './routes/upload.routes';
import dashboardRoutes from './routes/dashboard.routes';
import path from 'path';
import User, { Role } from './models/User';
import { initReminderService } from './services/reminderService';
import { initSocketService } from './services/socketService';
import './config/passport';

connectDB().then(async () => {
  if (process.env.CLEAN_LEGACY_USERS === 'true') {
    const dummyId = '65f0a1b2c3d4e5f607890abc';
    const dummyResult = await User.deleteOne({
      _id: dummyId,
      email: 'admin@dev.com',
      googleId: 'dummy',
    });

    if (dummyResult.deletedCount > 0) {
      console.log('Removed legacy dummy SuperAdmin user');
    }

    const exampleResult = await User.deleteMany({
      $or: [
        { _id: { $in: [
          '65f0a1b2c3d4e5f607890ab1',
          '65f0a1b2c3d4e5f607890ab2',
          '65f0a1b2c3d4e5f607890ab3',
          '65f0a1b2c3d4e5f607890ab4',
        ] } },
        { email: { $in: [
          'alice@example.com',
          'bob@example.com',
          'charlie@example.com',
          'diana@example.com',
        ] } },
      ],
    });

    if (exampleResult.deletedCount > 0) {
      console.log(`Removed ${exampleResult.deletedCount} legacy example users`);
    }
  }
});
initReminderService();

const app = express();
const server = createServer(app);

// Initialize Socket.io
initSocketService(server);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', momRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/action-items', actionItemRoutes);
app.use('/api/meetings', uploadRoutes); // Mounts /:id/upload-report
app.use('/api/dashboard', dashboardRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
