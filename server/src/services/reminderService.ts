import cron from 'node-cron';
import Meeting, { MeetingStatus } from '../models/Meeting';
import Notification from '../models/Notification';
import User from '../models/User';
import { emitNotification } from './socketService';

// Run every minute
export const initReminderService = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      console.log(`[Cron] Checking for meeting reminders at ${now.toLocaleTimeString()}`);
      
      // Look for meetings that are active and not cancelled
      const upcomingMeetings = await Meeting.find({
        status: { $ne: MeetingStatus.Cancelled },
        date: { $gte: startOfDay } // Only today's or future meetings
      }).populate('participants.user').populate('organizerId');

      for (const meeting of upcomingMeetings) {
        // Parse meeting start time
        // Meeting date is stored at midnight UTC usually, and startTime is a string like "14:30"
        const meetingDate = new Date(meeting.date);
        const [hours, minutes] = meeting.startTime.split(':').map(Number);
        
        const meetingStart = new Date(
          meetingDate.getFullYear(),
          meetingDate.getMonth(),
          meetingDate.getDate(),
          hours,
          minutes
        );

        const diffMs = meetingStart.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / 60000); 
        
        console.log(`[Cron Debug] Meeting: ${meeting.title} | Start: ${meetingStart.toLocaleTimeString()} | Now: ${now.toLocaleTimeString()} | Diff (mins): ${diffMinutes}`);

        let reminderMessage = '';
        let reminderType = '';

        // Generate reminders for exact intervals
        // We use small windows to account for slight cron delays
        if (diffMinutes === 24 * 60) {
          reminderMessage = `Reminder: ${meeting.title} is starting tomorrow at ${meeting.startTime}`;
          reminderType = 'Reminder 24h';
        } else if (diffMinutes === 60) {
          reminderMessage = `Reminder: ${meeting.title} is starting in 1 hour!`;
          reminderType = 'Reminder 1h';
        } else if (diffMinutes === 10) {
          reminderMessage = `Reminder: ${meeting.title} is starting in 10 minutes! Join soon.`;
          reminderType = 'Reminder 10m';
        }

        if (reminderMessage) {
          const notificationsToCreate: any[] = [];
          
          // Combine participants and organizer
          const allUsersToNotify = [
            ...(meeting.participants.map(p => (p as any).user)),
            meeting.organizerId
          ].filter(Boolean); // filter out nulls

          for (const userDoc of allUsersToNotify) {
            if (userDoc && userDoc._id) {
              // Fetch full user to get preferences
              const fullUser = await User.findById(userDoc._id);
              
              if (
                fullUser &&
                fullUser.notificationPreferences?.enabled !== false &&
                fullUser.notificationPreferences?.reminders !== false &&
                !fullUser.mutedMeetings?.includes(meeting._id as any)
              ) {
                // Prevent duplicate notifications if organizer is also a participant
                const alreadyAdded = notificationsToCreate.some(n => n.recipient.toString() === fullUser._id.toString());
                
                if (!alreadyAdded) {
                  notificationsToCreate.push({
                    recipient: fullUser._id,
                    type: reminderType,
                    message: reminderMessage,
                    relatedMeeting: meeting._id,
                    actionUrl: `/meetings/${meeting._id}`
                  });
                }
              }
            }
          }

          if (notificationsToCreate.length > 0) {
            const createdNotifications = await Notification.insertMany(notificationsToCreate);
            createdNotifications.forEach((notification) => {
              emitNotification(notification.recipient.toString(), notification);
            });
            console.log(`Dispatched ${notificationsToCreate.length} reminders for meeting ${meeting._id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in reminder cron job:', error);
    }
  });

  console.log('Reminder Service initialized');
};
