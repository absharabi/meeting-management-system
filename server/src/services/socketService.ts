import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import Meeting from '../models/Meeting';
import { isMeetingCancelled } from '../utils/meetingState';

let io: SocketIOServer;

// Map user ID to their active Socket ID
// In a production app, a user might have multiple tabs open (multiple sockets),
// so this could be Map<string, string[]> instead. We'll use Map<string, string> for simplicity in MVP.
const connectedUsers = new Map<string, string>();

export const initSocketService = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('register', (userId: string) => {
      console.log(`User ${userId} registered with socket ${socket.id}`);
      connectedUsers.set(userId, socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Remove the disconnected socket from our map
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`User ${userId} unregistered`);
          break;
        }
      }
    });

    // --- Live Collaborative Notes ---
    
    // User joins a specific meeting's live notes room
    socket.on('join-meeting-room', async (meetingId: string) => {
      const meeting = await Meeting.findById(meetingId).select('status');
      if (!meeting || isMeetingCancelled(meeting)) {
        socket.emit('meeting-locked', 'This meeting is cancelled. Live notes are locked.');
        return;
      }
      socket.join(`meeting_${meetingId}`);
      console.log(`Socket ${socket.id} joined room: meeting_${meetingId}`);
    });

    // User leaves a specific meeting's live notes room
    socket.on('leave-meeting-room', (meetingId: string) => {
      socket.leave(`meeting_${meetingId}`);
      console.log(`Socket ${socket.id} left room: meeting_${meetingId}`);
    });

    // User broadcasts a text update to everyone else in the room
    socket.on('note-update', async ({ meetingId, content }: { meetingId: string, content: string }) => {
      const meeting = await Meeting.findById(meetingId).select('status');
      if (!meeting || isMeetingCancelled(meeting)) {
        socket.emit('meeting-locked', 'This meeting is cancelled. Live notes are locked.');
        return;
      }
      // broadcast to everyone in the room EXCEPT the sender
      socket.to(`meeting_${meetingId}`).emit('note-updated', content);
    });

  });

  console.log('Socket Service initialized');
};

/**
 * Emit a notification directly to a specific user's active session
 */
export const emitNotification = (userId: string, notificationData: any) => {
  if (!io) return;
  
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit('new_notification', notificationData);
  }
};
