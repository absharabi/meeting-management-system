import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Meeting, { MeetingMode, MeetingStatus } from '../models/Meeting';
import User, { Role } from '../models/User';
import Agenda from '../models/Agenda';
import ActionItem from '../models/ActionItem';
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
    const populatedMeeting = await Meeting.findById(newMeeting._id)
      .populate('participants.user', 'email name notificationPreferences mutedMeetings')
      .populate('organizerId', 'email name');
      
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
          `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <!-- Header with Gradient -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Meeting Scheduled</h1>
              <p style="color: #e2e8f0; font-size: 16px; margin: 10px 0 0 0; opacity: 0.9;">You have a new invitation.</p>
            </div>

            <!-- Body -->
            <div style="padding: 30px;">
              <p style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin-top: 0;">Hi <strong>${p.user.name}</strong>,</p>
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6;">Your organizer has invited you to a new meeting. Please find the details below and let the team know if you can attend.</p>

              <!-- Meeting Details Card -->
              <div style="background-color: #1e293b; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0;">${newMeeting.title}</h3>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                  <tr>
                    <td width="30" style="padding-bottom: 10px;">📅</td>
                    <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Date:</strong> ${new Date(newMeeting.date).toDateString()}</td>
                  </tr>
                  <tr>
                    <td width="30" style="padding-bottom: 10px;">⏰</td>
                    <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Time:</strong> ${newMeeting.startTime} - ${newMeeting.endTime || 'End'}</td>
                  </tr>
                  <tr>
                    <td width="30">📍</td>
                    <td><strong style="color: #e2e8f0;">Venue:</strong> ${newMeeting.venue || newMeeting.mode}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 40px 0 20px 0;">
                <a href="${process.env.FRONTEND_URL}/meetings/${newMeeting._id}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 30px;">
                  Review Agenda & RSVP
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #0b1121; padding: 20px; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">
                Sent securely from Meeting Management System.<br>
                Reply directly to this email to contact the organizer.
              </p>
            </div>
          </div>`,
          {
            title: newMeeting.title,
            description: newMeeting.description || '',
            date: newMeeting.date.toISOString().split('T')[0],
            startTime: newMeeting.startTime,
            endTime: newMeeting.endTime,
            venue: newMeeting.venue || ''
          },
          (populatedMeeting.organizerId as any)?.email
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
    const requestingUser = (req as any).user;
    
    // Build an advanced search query object
    let query: any = {};

    // Deep Keyword Search
    if (keyword) {
      const regexKeyword = new RegExp(keyword as string, 'i');
      
      // 1. Find users matching the keyword
      const matchedUsers = await User.find({
        $or: [
          { name: regexKeyword },
          { email: regexKeyword }
        ]
      }).select('_id');
      const matchedUserIds = matchedUsers.map(user => user._id);

      // 2. Find matching Agendas and Action Items
      const [matchedAgendas, matchedActionItems] = await Promise.all([
        Agenda.find({
          $or: [{ title: regexKeyword }, { description: regexKeyword }]
        }).select('meetingId'),
        ActionItem.find({
          $or: [{ title: regexKeyword }, { description: regexKeyword }]
        }).select('meetingId')
      ]);

      const matchedMeetingIdsFromRelated = [
        ...matchedAgendas.map(a => a.meetingId),
        ...matchedActionItems.map(a => a.meetingId)
      ];

      // 3. Build the $or array
      query.$or = [
        { title: regexKeyword },
        { description: regexKeyword },
        { status: regexKeyword }
      ];

      // 4. Add user references if any users matched
      if (matchedUserIds.length > 0) {
        query.$or.push({ organizerId: { $in: matchedUserIds } });
        query.$or.push({ 'participants.user': { $in: matchedUserIds } });
      }

      // 5. Add meeting references from matched Agendas/ActionItems
      if (matchedMeetingIdsFromRelated.length > 0) {
        query.$or.push({ _id: { $in: matchedMeetingIdsFromRelated } });
      }
    }

    // Status Filter
    if (status) query.status = status;

    // Date Filter
    if (date) query.date = new Date(date as string);

    // Venue Filter
    if (venue) query.venue = venue;

    // Enforce data privacy for non-admins
    if (!isGlobalAdmin(requestingUser.role)) {
      const accessFilter = {
        $or: [
          { organizerId: requestingUser.id },
          { 'participants.user': requestingUser.id },
          { visibility: 'Public' }
        ]
      };
      
      if (query.$or) {
        // If there's already an $or (from keyword search), wrap both in $and
        query = { $and: [{ $or: query.$or }, accessFilter] };
        delete query.$or; // Remove the old $or
      } else {
        query.$or = accessFilter.$or;
      }
    }

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

    if (target.status === MeetingStatus.Completed) {
      res.status(400).json({ message: 'Cannot edit a meeting that is already completed.' });
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
      const populatedMeeting = await Meeting.findById(updated._id)
        .populate('participants.user', 'email name notificationPreferences mutedMeetings')
        .populate('organizerId', 'email name');
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
          // Send update email
          if (userDoc.email) {
            sendEmail(
              userDoc.email,
              `Meeting Updated: ${updated.title}`,
              `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Meeting Updated</h1>
                  <p style="color: #fef3c7; font-size: 16px; margin: 10px 0 0 0; opacity: 0.9;">Details have been changed.</p>
                </div>
                <div style="padding: 30px;">
                  <p style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin-top: 0;">Hi <strong>${userDoc.name}</strong>,</p>
                  <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6;">The organizer has updated the details for this meeting. Please review the new details below.</p>
                  <div style="background-color: #1e293b; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 30px 0;">
                    <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0;">${updated.title}</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <tr>
                        <td width="30" style="padding-bottom: 10px;">📅</td>
                        <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Date:</strong> ${new Date(updated.date).toDateString()}</td>
                      </tr>
                      <tr>
                        <td width="30" style="padding-bottom: 10px;">⏰</td>
                        <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Time:</strong> ${updated.startTime} - ${updated.endTime || 'End'}</td>
                      </tr>
                      <tr>
                        <td width="30">📍</td>
                        <td><strong style="color: #e2e8f0;">Venue:</strong> ${updated.venue || updated.mode}</td>
                      </tr>
                    </table>
                  </div>
                  <div style="text-align: center; margin: 40px 0 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/meetings/${updated._id}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 30px;">
                      View Updated Meeting
                    </a>
                  </div>
                </div>
                <div style="background-color: #0b1121; padding: 20px; text-align: center;">
                  <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">
                    Sent securely from Meeting Management System.<br>
                    Reply directly to this email to contact the organizer.
                  </p>
                </div>
              </div>`,
              {
                title: updated.title,
                description: updated.description || '',
                date: updated.date.toISOString().split('T')[0],
                startTime: updated.startTime,
                endTime: updated.endTime,
                venue: updated.venue || ''
              },
              (populatedMeeting?.organizerId as any)?.email
            );
          }

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

    const populatedTarget = await Meeting.findById(req.params.id)
      .populate('participants.user', 'email name notificationPreferences mutedMeetings')
      .populate('organizerId', 'email name');
    const deleted = await Meeting.findByIdAndDelete(req.params.id);

    // Delete any existing notifications related to this meeting
    await Notification.deleteMany({ relatedMeeting: req.params.id });

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
          // Send cancellation email
          if (userDoc.email) {
            sendEmail(
              userDoc.email,
              `Meeting Cancelled: ${populatedTarget.title}`,
              `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Meeting Cancelled</h1>
                  <p style="color: #fee2e2; font-size: 16px; margin: 10px 0 0 0; opacity: 0.9;">The meeting has been called off.</p>
                </div>
                <div style="padding: 30px;">
                  <p style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin-top: 0;">Hi <strong>${userDoc.name}</strong>,</p>
                  <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6;">The organizer has cancelled the following meeting.</p>
                  <div style="background-color: #1e293b; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 30px 0;">
                    <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; text-decoration: line-through;">${populatedTarget.title}</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                      <tr>
                        <td width="30" style="padding-bottom: 10px;">📅</td>
                        <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Date:</strong> <span style="text-decoration: line-through;">${new Date(populatedTarget.date).toDateString()}</span></td>
                      </tr>
                      <tr>
                        <td width="30" style="padding-bottom: 10px;">⏰</td>
                        <td style="padding-bottom: 10px;"><strong style="color: #e2e8f0;">Time:</strong> <span style="text-decoration: line-through;">${populatedTarget.startTime} - ${populatedTarget.endTime || 'End'}</span></td>
                      </tr>
                    </table>
                  </div>
                </div>
                <div style="background-color: #0b1121; padding: 20px; text-align: center;">
                  <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">
                    Sent securely from Meeting Management System.<br>
                    Reply directly to this email to contact the organizer.
                  </p>
                </div>
              </div>`,
              undefined,
              (populatedTarget.organizerId as any)?.email
            );
          }

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
