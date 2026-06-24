import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Meeting, { MeetingMode, MeetingStatus } from '../models/Meeting';
import User, { Role } from '../models/User';
import Agenda from '../models/Agenda';
import ActionItem from '../models/ActionItem';
import { rejectCancelledMeeting } from '../utils/meetingState';
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
    if (requestingUser.role === Role.SuperAdmin || requestingUser.role === Role.Admin) {
      res.status(403).json({ message: 'Admins and SuperAdmins cannot schedule meetings.' });
      return;
    }
    const { date, startTime, endTime, venue, mode, participants } = req.body;

    const meetingDateObj = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDateObj < today) {
      res.status(400).json({ message: 'Meeting date cannot be in the past.' });
      return;
    }

    const [year, month, day] = typeof date === 'string' ? date.split('T')[0].split('-').map(Number) : [new Date(date).getFullYear(), new Date(date).getMonth() + 1, new Date(date).getDate()];
    const todayNow = new Date();
    const isToday = todayNow.getFullYear() === year && (todayNow.getMonth() + 1) === month && todayNow.getDate() === day;

    if (isToday && startTime) {
      const now = new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      const startObj = new Date();
      startObj.setHours(hours, minutes, 0, 0);
      if (startObj < now) {
        res.status(400).json({ message: 'Meeting start time cannot be in the past.' });
        return;
      }
    }

    let finalParticipants = participants || [];
    if (req.body.visibility === 'Public') {
      const allUsers = await User.find({ role: { $nin: [Role.Admin, Role.SuperAdmin] } }).select('_id');
      finalParticipants = allUsers.map(user => user._id.toString());
    }

    if (!finalParticipants || finalParticipants.length === 0) {
      res.status(400).json({ message: 'At least 1 participant is required to create a meeting.' });
      return;
    }

    const formattedParticipants = finalParticipants.map((id: string) => ({ 
      user: id, 
      status: id.toString() === requestingUser.id.toString() ? 'Accepted' : 'Pending' 
    }));

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

            <!-- Footer & Compliance -->
            <div style="background-color: #0b1121; padding: 30px 20px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="color: #64748b; font-size: 12px; margin: 0 0 10px 0; line-height: 1.6;">
                <strong>Why are you receiving this email?</strong><br>
                You are receiving this automated notification because you are a registered participant or organizer within the official Meeting Management System.
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0 0 10px 0; line-height: 1.6;">
                <strong>Mailing Address:</strong><br>
                Meeting Management System HQ<br>
                123 Enterprise Avenue, Tech District, 10001
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 20px 0 0 0; line-height: 1.5;">
                If you wish to stop receiving these notifications, please log in to your dashboard and update your <a href="${process.env.FRONTEND_URL}/settings" style="color: #8b5cf6; text-decoration: underline;">Notification Preferences</a> or contact your system administrator.
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
    const { keyword, status, date, venue, momStatus } = req.query;
    const requestingUser = (req as any).user;

    // Build an advanced search query object
    let query: any = {};

    // Deep Keyword Search
    // TODO: This regex search is getting slow on production. We should migrate this to MongoDB Text Indexes in Q3.
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

    // MoM Status Filter
    if (momStatus) query.momStatus = momStatus;

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

    if (rejectCancelledMeeting(res, target)) return;

    if (target.status === MeetingStatus.Completed) {
      res.status(400).json({ message: 'Cannot edit a meeting that is already completed.' });
      return;
    }

    if (!isGlobalAdmin(requestingUser.role) && target.organizerId.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'You do not have permission to edit this meeting' });
      return;
    }

    // Enforce 24-hour deadline for editing meeting details
    // Only enforce this if we are updating details other than status
    const isOnlyStatusUpdate = Object.keys(req.body).length === 1 && req.body.status;
    const isPostponing = req.body.status === 'Postponed';

    if (!isOnlyStatusUpdate && !isPostponing) {
      const targetDate = new Date(target.date);
      const meetingDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
      const startTimeStr = target.startTime || '00:00';
      const meetingStartDateTime = new Date(`${meetingDateStr}T${startTimeStr}:00`);
      const now = new Date();

      if (target.meetingType === 'Emergency Meeting') {
        if (meetingStartDateTime.getTime() <= now.getTime()) {
          res.status(400).json({ message: 'Cannot edit the emergency meeting after it has started.' });
          return;
        }
      } else {
        const hoursDiff = (meetingStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          res.status(400).json({ message: 'Meeting details can only be edited up to 24 hours before the meeting.' });
          return;
        }
      }
    }

    // Venue Conflict Detection for Updates
    const { date, startTime, endTime, venue, mode, participants } = req.body;

    if (isPostponing) {
      if (!date || !startTime || !endTime) {
        res.status(400).json({ message: 'A new date, start time, and end time are required when postponing a meeting.' });
        return;
      }
      if (endTime <= startTime) {
        res.status(400).json({ message: 'Meeting end time must be later than the start time.' });
        return;
      }

      const postponedMode = mode || target.mode;
      if ((postponedMode === MeetingMode.Offline || postponedMode === MeetingMode.Hybrid) && !venue?.trim()) {
        res.status(400).json({ message: 'A new venue is required when postponing an offline or hybrid meeting.' });
        return;
      }
    }

    if (date) {
      const meetingDateObj = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (meetingDateObj < today) {
        res.status(400).json({ message: 'Meeting date cannot be set in the past.' });
        return;
      }
      
      const checkStartTime = startTime || target.startTime;
      if (checkStartTime) {
        const [year, month, day] = typeof date === 'string' ? date.split('T')[0].split('-').map(Number) : [new Date(date).getFullYear(), new Date(date).getMonth() + 1, new Date(date).getDate()];
        const todayNow = new Date();
        const isToday = todayNow.getFullYear() === year && (todayNow.getMonth() + 1) === month && todayNow.getDate() === day;

        if (isToday) {
          const now = new Date();
          const [hours, minutes] = checkStartTime.split(':').map(Number);
          const startObj = new Date();
          startObj.setHours(hours, minutes, 0, 0);
          if (startObj < now) {
            res.status(400).json({ message: 'Meeting start time cannot be set in the past.' });
            return;
          }
        }
      }
    }

    const updateData = { ...req.body };
    let finalParticipants = participants;

    if (updateData.visibility === 'Public') {
      const allUsers = await User.find({ role: { $nin: [Role.Admin, Role.SuperAdmin] } }).select('_id');
      finalParticipants = allUsers.map(user => user._id.toString());
    }

    if (finalParticipants) {
      if (finalParticipants.length === 0) {
        res.status(400).json({ message: 'At least 1 participant is required to edit a meeting.' });
        return;
      }
      updateData.participants = finalParticipants.map((id: string) => {
        const participantId = id.toString();
        const isOrganizer = participantId === target.organizerId.toString();
        const existingParticipant = target.participants?.find(
          (participant: any) =>
            (participant.user?._id || participant.user).toString() === participantId
        );

        return {
          user: id,
          status: isOrganizer
            ? 'Accepted'
            : isPostponing
              ? 'Pending'
              : existingParticipant?.status || 'Pending',
          reason: isPostponing ? '' : existingParticipant?.reason || '',
          nominee: isPostponing ? null : existingParticipant?.nominee || null,
          nomineeStatus: isPostponing ? 'None' : existingParticipant?.nomineeStatus || 'None'
        };
      });
    } else if (isPostponing) {
      // If postponing, reset all existing participants to Pending so they can RSVP again
      updateData.participants = target.participants.map((participant: any) => {
        const participantId = participant.user?._id || participant.user;
        return {
          user: participantId,
          status: participantId.toString() === target.organizerId.toString() ? 'Accepted' : 'Pending',
          reason: '',
          nominee: null,
          nomineeStatus: 'None'
        };
      });
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
              `${isPostponing ? 'Meeting Postponed - RSVP Required' : 'Meeting Updated'}: ${updated.title}`,
              `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Meeting Updated</h1>
                  <p style="color: #fef3c7; font-size: 16px; margin: 10px 0 0 0; opacity: 0.9;">${isPostponing ? 'Please accept or decline again.' : 'Details have been changed.'}</p>
                </div>
                <div style="padding: 30px;">
                  <p style="color: #f8fafc; font-size: 16px; line-height: 1.6; margin-top: 0;">Hi <strong>${userDoc.name}</strong>,</p>
                  <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6;">${isPostponing ? 'The organizer has postponed this meeting. Your previous RSVP has been reset, so please accept or decline again after reviewing the new schedule.' : 'The organizer has updated the details for this meeting. Please review the new details below.'}</p>
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
                      ${isPostponing ? 'Accept or Decline Again' : 'View Updated Meeting'}
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
            type: isPostponing ? 'Meeting Postponed' : 'Meeting Updated',
            message: isPostponing ? `Meeting postponed. Please accept or decline again: ${updated.title}` : `Meeting details updated: ${updated.title}`,
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

    if (rejectCancelledMeeting(res, target)) return;

    if (!isGlobalAdmin(requestingUser.role) && target.organizerId.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'You do not have permission to delete this meeting' });
      return;
    }

    const populatedTarget = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status: MeetingStatus.Cancelled },
      { new: true }
    )
      .populate('participants.user', 'email name notificationPreferences mutedMeetings')
      .populate('organizerId', 'email name');

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

    res.json({ message: 'Meeting successfully cancelled', meeting: populatedTarget });
  } catch (error) {
    res.status(500).json({ message: 'Server error while deleting meeting', error });
  }
};

export const hardDeleteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!isGlobalAdmin(requestingUser.role)) {
      res.status(403).json({ message: 'Only Admins or SuperAdmins can permanently delete meetings' });
      return;
    }

    const deleted = await Meeting.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    // Optionally delete related notifications, agendas, action items etc.
    await Notification.deleteMany({ relatedMeeting: req.params.id });
    await Agenda.deleteMany({ meetingId: req.params.id });
    await ActionItem.deleteMany({ meetingId: req.params.id });

    res.json({ message: 'Meeting permanently deleted from database' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while permanently deleting meeting', error });
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

    if (rejectCancelledMeeting(res, target)) return;

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
    const { status, reason, nomineeId } = req.body; // 'Accepted' | 'Declined'

    if (!['Accepted', 'Declined'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const meeting = await Meeting.findById(req.params.id).populate('organizerId', 'name email');
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (rejectCancelledMeeting(res, meeting)) return;

    const participantIndex = meeting.participants.findIndex(p => p.user.toString() === requestingUser.id);
    if (participantIndex === -1) {
      res.status(403).json({ message: 'You are not a participant in this meeting' });
      return;
    }

    meeting.participants[participantIndex].status = status;
    if (status === 'Declined') {
      if (reason) meeting.participants[participantIndex].reason = reason;
      if (nomineeId) {
        meeting.participants[participantIndex].nominee = nomineeId;
        meeting.participants[participantIndex].nomineeStatus = 'Pending';
      }
    }

    await meeting.save();

    res.json({ message: `RSVP updated to ${status}`, meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating RSVP', error });
  }
};

export const approveNominee = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const meetingId = req.params.id as string;
    const participantId = req.params.participantId as string;

    const meeting = await Meeting.findById(meetingId).populate('organizerId', 'name email');
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (rejectCancelledMeeting(res, meeting)) return;

    if (!isGlobalAdmin(requestingUser.role) && meeting.organizerId._id.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'Only the organizer can approve nominees' });
      return;
    }

    const pIndex = meeting.participants.findIndex(p => p.user.toString() === participantId);
    if (pIndex === -1 || !meeting.participants[pIndex].nominee) {
      res.status(400).json({ message: 'Invalid nomination' });
      return;
    }

    meeting.participants[pIndex].nomineeStatus = 'Approved';
    const nomineeId = meeting.participants[pIndex].nominee;

    // Add nominee to participants list and force them to 'Accepted'
    const nomineeIndex = meeting.participants.findIndex(p => p.user.toString() === nomineeId?.toString());
    if (nomineeIndex === -1 && nomineeId) {
      meeting.participants.push({ user: nomineeId, status: 'Accepted' } as any);
    } else if (nomineeIndex !== -1) {
      meeting.participants[nomineeIndex].status = 'Accepted';
    }

    await meeting.save();

    // Send emails
    const ogParticipantDoc = await User.findById(participantId);
    const nomineeDoc = await User.findById(nomineeId);
    const organizerName = (meeting.organizerId as any)?.name || 'The Organizer';

    if (ogParticipantDoc?.email && nomineeDoc?.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Nomination Approved</h2>
          <p><strong>${organizerName}</strong> has approved the nomination.</p>
          <p><strong>${nomineeDoc.name}</strong> has been invited to attend <strong>${meeting.title}</strong> on behalf of <strong>${ogParticipantDoc.name}</strong>.</p>
        </div>
      `;
      sendEmail(ogParticipantDoc.email, `Nomination Approved: ${meeting.title}`, emailHtml);
      sendEmail(nomineeDoc.email, `Meeting Invitation (Nominee): ${meeting.title}`, emailHtml);

      // Create in-app notifications
      const nomineeNotif = await Notification.create({
        recipient: nomineeId,
        type: 'meeting_invitation',
        message: `You have been approved to represent ${ogParticipantDoc.name} in the meeting: ${meeting.title}`,
        relatedMeeting: meetingId,
        actionUrl: `/meetings/${meetingId}`
      });

      const participantNotif = await Notification.create({
        recipient: participantId,
        type: 'nominee_approved',
        message: `Your nomination of ${nomineeDoc.name} for the meeting ${meeting.title} has been approved.`,
        relatedMeeting: meetingId,
        actionUrl: `/meetings/${meetingId}`
      });

      emitNotification(nomineeId.toString(), nomineeNotif);
      emitNotification(participantId.toString(), participantNotif);
    }

    res.json({ message: 'Nominee approved successfully', meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const rejectNominee = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const meetingId = req.params.id as string;
    const participantId = req.params.participantId as string;

    const meeting = await Meeting.findById(meetingId).populate('organizerId', 'name email');
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (rejectCancelledMeeting(res, meeting)) return;

    if (!isGlobalAdmin(requestingUser.role) && meeting.organizerId._id.toString() !== requestingUser.id) {
      res.status(403).json({ message: 'Only the organizer can reject nominees' });
      return;
    }

    const pIndex = meeting.participants.findIndex(p => p.user.toString() === participantId);
    if (pIndex === -1 || !meeting.participants[pIndex].nominee) {
      res.status(400).json({ message: 'Invalid nomination' });
      return;
    }

    meeting.participants[pIndex].nomineeStatus = 'Rejected';
    await meeting.save();

    // Send email to original participant
    const ogParticipantDoc = await User.findById(participantId);
    const organizerName = (meeting.organizerId as any)?.name || 'The Organizer';

    if (ogParticipantDoc?.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Nomination Rejected</h2>
          <p><strong>${organizerName}</strong> has rejected your proposed nominee for <strong>${meeting.title}</strong>.</p>
          <p>Please contact the organizer if you have any questions.</p>
        </div>
      `;
      sendEmail(ogParticipantDoc.email, `Nomination Rejected: ${meeting.title}`, emailHtml);
    }

    res.json({ message: 'Nominee rejected successfully', meeting });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const searchMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const requestingUser = (req as any).user;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ message: 'Search query is required' });
      return;
    }

    let query: any = { $text: { $search: q } };

    // Enforce data privacy for non-admins
    if (!isGlobalAdmin(requestingUser.role)) {
      query.$or = [
        { organizerId: requestingUser.id },
        { 'participants.user': requestingUser.id },
        { visibility: 'Public' }
      ];
    }

    const meetings = await Meeting.find(
      query,
      { score: { $meta: "textScore" } }
    )
      .populate('organizerId', 'name email')
      .populate('participants.user', 'name email department')
      .sort({ score: { $meta: "textScore" } })
      .limit(50);

    res.json(meetings);
  } catch (error) {
    console.error('Error in searchMeetings:', error);
    res.status(500).json({ message: 'Server error while searching meetings', error });
  }
};
