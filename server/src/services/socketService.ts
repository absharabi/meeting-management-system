import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import Meeting from '../models/Meeting';
import { isMeetingCancelled } from '../utils/meetingState';

let io: SocketIOServer;

// Map user ID to a Set of their active Socket IDs
// This allows multiple tabs open for the same user to all receive real-time notifications.
const connectedUsers = new Map<string, Set<string>>();

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
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set<string>());
      }
      connectedUsers.get(userId)!.add(socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Remove the disconnected socket from our map
      for (const [userId, socketIds] of connectedUsers.entries()) {
        if (socketIds.has(socket.id)) {
          socketIds.delete(socket.id);
          console.log(`Socket ${socket.id} removed from user ${userId}`);
          
          if (socketIds.size === 0) {
            connectedUsers.delete(userId);
            console.log(`User ${userId} fully unregistered (no active tabs)`);
          }
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
  
  const socketIds = connectedUsers.get(userId.toString());
  if (socketIds && socketIds.size > 0) {
    socketIds.forEach(socketId => {
      io.to(socketId).emit('new_notification', notificationData);
    });
  }
};
