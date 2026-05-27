import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Meeting, { MeetingMode, MeetingStatus } from '../models/Meeting';
import { Role } from '../models/User';
import Notification from '../models/Notification';
import { sendEmail } from '../utils/email';
import { emitNotification } from '../services/socketService';

// Helper to check if a user is a global admin
const isGlobalAdmin = (role: string) => {
  return [Role.SuperAdmin, Role.Admin].includes(role as Role);
};

export const createMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    // All authenticated users can create meetings

    const { date, startTime, endTime, venue, mode, participants } = req.body;
    
    const meetingDateObj = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDateObj < today) {
      res.status(400).json({ message: 'Meeting date cannot be in the past.' });
      return;
    }

    const formattedParticipants = participants?.map((id: string) => ({ user: id, status: 'Pending' })) || [];

    // Venue Conflict Detection
    if ((mode === MeetingMode.Offline || mode === MeetingMode.Hybrid) && venue) {
      const conflict = await Meeting.findOne({
        venue,
        date: new Date(date),
        $or: [
          { startTime: { $lt: endTime }, endTime: { $gt: startTime } } // Overlapping time check
        ],
        status: { $ne: MeetingStatus.Cancelled } // Ignore cancelled meetings
      });

      if (conflict) {
        res.status(409).json({ message: 'Venue conflict detected. The venue is already booked for this time.' });
        return;
      }
    }

    // Handle Recurrence
    const recurrencePattern = req.body.recurrencePattern || 'None';
    const recurrenceCount = parseInt(req.body.recurrenceCount) || 1;
    const groupId = recurrencePattern !== 'None' ? new mongoose.Types.ObjectId().toString() : undefined;

    const meetingsToCreate = [];
    let currentDate = new Date(req.body.date);

    for (let i = 0; i < recurrenceCount; i++) {
      meetingsToCreate.push({
        ...req.body,
        date: new Date(currentDate),
        participants: formattedParticipants,
        organizerId: requestingUser.id,
        groupId,
        recurrencePattern
      });

      // Increment date based on pattern
      if (recurrencePattern === 'Daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (recurrencePattern === 'Weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (recurrencePattern === 'Bi-Weekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else if (recurrencePattern === 'Monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    const createdMeetings = await Meeting.insertMany(meetingsToCreate);
    const newMeeting = createdMeetings[0]; // The first one for the email

    // Populate to get emails and preferences
    const populatedMeeting = await Meeting.findById(newMeeting._id).populate('participants.user', 'email name notificationPreferences mutedMeetings');
    if (!populatedMeeting) {
      res.status(500).json({ message: 'Failed to populate created meeting' });
      return;
    }
    
    // Send email to participants
    populatedMeeting.participants.forEach((p: any) => {
      if (p.user && p.user.email) {
        sendEmail(
          p.user.email,
          `Meeting Invitation: ${newMeeting.title}`,
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Meeting Invitation</h2>
            <p>Hello ${p.user.name},</p>
            <p>You have been invited to a new meeting by your organization.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Topic:</strong> ${newMeeting.title}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(newMeeting.date).toDateString()}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${newMeeting.startTime}</p>
            </div>
            <p>Please log in to the Meeting Management System to view the full agenda and submit your RSVP.</p>
          </div>`,
          {
            title: newMeeting.title,
            description: newMeeting.description || '',
            date: newMeeting.date.toISOString().split('T')[0],
            startTime: newMeeting.startTime,
            endTime: newMeeting.endTime,
            venue: newMeeting.venue || ''
          }
        );
      }
    });

    // Create in-app notifications
    const notificationsToCreate: any[] = [];
    
    // Add one for the organizer
    notificationsToCreate.push({
      recipient: requestingUser.id,
      type: 'Meeting Created',
      message: `You successfully scheduled: ${newMeeting.title}`,
      relatedMeeting: newMeeting._id,
      actionUrl: `/meetings/${newMeeting._id}`
    });

    populatedMeeting.participants.forEach((p: any) => {
      const userDoc = p.user;
      if (userDoc && userDoc._id) {
        // Check preferences and muting
        if (userDoc.notificationPreferences?.enabled === false) return;
        if (userDoc.notificationPreferences?.meetingUpdates === false) return;
        if (userDoc.mutedMeetings?.includes(newMeeting._id)) return;

        notificationsToCreate.push({
          recipient: userDoc._id,
          type: 'Meeting Created',
          message: `You have been invited to a new meeting: ${newMeeting.title}`,
          relatedMeeting: newMeeting._id,
          actionUrl: `/meetings/${newMeeting._id}`
        });
      }
    });
    if (notificationsToCreate.length > 0) {
      const createdNotifications = await Notification.insertMany(notificationsToCreate);
      createdNotifications.forEach((notification) => {
        emitNotification(notification.recipient.toString(), notification);
      });
    }

    res.status(201).json(populatedMeeting);
  } catch (error) {
    console.error('Error in createMeeting:', error);
    res.status(500).json({ message: 'Server error while creating meeting', error });
  }
};

export const getMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, status, date, venue } = req.query;
    
    // Build an advanced search query object
    let query: any = {};

    // Keyword Search (searches title and description)
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword as string, $options: 'i' } },
        { description: { $regex: keyword as string, $options: 'i' } }
      ];
    }

    // Status Filter
    if (status) query.status = status;

    // Date Filter
    if (date) query.date = new Date(date as string);

    // Venue Filter
    if (venue) query.venue = venue;

    const meetings = await Meeting.find(query)
      .populate('organizerId', 'name email')
      .populate('participants.user', 'name email department')
      .populate('attendance', 'name email')
      .sort({ date: 1, startTime: 1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching meetings', error });
  }
};

export const updateMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const meetingId = req.params.id;
    const target = await Meeting.findById(meetingId);
    
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (!isGlobalAdmin(requestingUser.role) && target.organizerId.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'You do not have permission to edit this meeting' });
      return;
    }

    // Venue Conflict Detection for Updates
    const { date, startTime, endTime, venue, mode, participants } = req.body;
    
    if (date) {
      const meetingDateObj = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (meetingDateObj < today) {
        res.status(400).json({ message: 'Meeting date cannot be set in the past.' });
        return;
      }
    }

    const updateData = { ...req.body };
    if (participants) {
      updateData.participants = participants.map((id: string) => ({ user: id, status: 'Pending' }));
    }
    const checkMode = mode || target.mode;
    const checkVenue = venue || target.venue;
    
    if ((checkMode === MeetingMode.Offline || checkMode === MeetingMode.Hybrid) && checkVenue) {
      const conflict = await Meeting.findOne({
        _id: { $ne: meetingId }, // Exclude the current meeting from the check
        venue: checkVenue,
        date: new Date(date || target.date),
        $or: [
          { startTime: { $lt: endTime || target.endTime }, endTime: { $gt: startTime || target.startTime } }
        ],
        status: { $ne: MeetingStatus.Cancelled }
      });

      if (conflict) {
        res.status(409).json({ message: 'Venue conflict detected for the updated time/venue.' });
        return;
      }
    }

    const updated = await Meeting.findByIdAndUpdate(meetingId, updateData, { new: true });
    
    // Create in-app notifications
    if (updated) {
      const populatedMeeting = await Meeting.findById(updated._id).populate('participants.user', 'email name notificationPreferences mutedMeetings');
      const notificationsToCreate: any[] = [];
      
      // Add one for the organizer
      notificationsToCreate.push({
        recipient: requestingUser.id,
        type: 'Meeting Updated',
        message: `You updated the meeting: ${updated.title}`,
        relatedMeeting: updated._id,
        actionUrl: `/meetings/${updated._id}`
      });

      populatedMeeting?.participants.forEach((p: any) => {
        const userDoc = p.user;
        if (userDoc && userDoc._id) {
          if (userDoc.notificationPreferences?.enabled === false) return;
          if (userDoc.notificationPreferences?.meetingUpdates === false) return;
          if (userDoc.mutedMeetings?.includes(updated._id)) return;

          notificationsToCreate.push({
            recipient: userDoc._id,
            type: 'Meeting Updated',
            message: `Meeting details updated: ${updated.title}`,
            relatedMeeting: updated._id,
            actionUrl: `/meetings/${updated._id}`
          });
        }
      });
      if (notificationsToCreate.length > 0) {
        const createdNotifications = await Notification.insertMany(notificationsToCreate);
        createdNotifications.forEach((notification) => {
          emitNotification(notification.recipient.toString(), notification);
        });
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating meeting', error });
  }
};

export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const target = await Meeting.findById(req.params.id);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (!isGlobalAdmin(requestingUser.role) && target.organizerId.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'You do not have permission to delete this meeting' });
      return;
    }

    const populatedTarget = await Meeting.findById(req.params.id).populate('participants.user', 'email name notificationPreferences mutedMeetings');
    const deleted = await Meeting.findByIdAndDelete(req.params.id);

    // Create in-app notifications
    if (populatedTarget) {
      const notificationsToCreate: any[] = [];
      
      // Add one for the organizer
      notificationsToCreate.push({
        recipient: requestingUser.id,
        type: 'Meeting Cancelled',
        message: `You successfully cancelled: ${populatedTarget.title}`
      });

      populatedTarget.participants.forEach((p: any) => {
        const userDoc = p.user;
        if (userDoc && userDoc._id) {
          if (userDoc.notificationPreferences?.enabled === false) return;
          if (userDoc.notificationPreferences?.meetingUpdates === false) return;
          if (userDoc.mutedMeetings?.includes(populatedTarget._id)) return;

          notificationsToCreate.push({
            recipient: userDoc._id,
            type: 'Meeting Cancelled',
            message: `Meeting has been cancelled: ${populatedTarget.title}`
          });
        }
      });
      if (notificationsToCreate.length > 0) {
        const createdNotifications = await Notification.insertMany(notificationsToCreate);
        createdNotifications.forEach((notification) => {
          emitNotification(notification.recipient.toString(), notification);
        });
      }
    }

    res.json({ message: 'Meeting successfully deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while deleting meeting', error });
  }
};

export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const target = await Meeting.findById(req.params.id);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (!isGlobalAdmin(requestingUser.role) && target.organizerId.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'Only the meeting organizer or an admin can mark attendance' });
      return;
    }

    const { attendanceList } = req.body; // Array of User IDs
    const updated = await Meeting.findByIdAndUpdate(
      req.params.id, 
      { attendance: attendanceList, status: MeetingStatus.Completed }, 
      { new: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating attendance', error });
  }
};

export const rsvpMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { status } = req.body; // 'Accepted' | 'Declined'
    
    if (!['Accepted', 'Declined'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    const participantIndex = meeting.participants.findIndex(p => p.user.toString() === requestingUser.id);
    if (participantIndex === -1) {
      res.status(403).json({ message: 'You are not a participant in this meeting' });
      return;
    }

    meeting.participants[participantIndex].status = status;
    await meeting.save();

    res.json({ message: `RSVP updated to ${status}`, meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating RSVP', error });
  }
};
