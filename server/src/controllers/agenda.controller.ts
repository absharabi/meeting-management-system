import { Request, Response } from 'express';
import Agenda, { AgendaStatus } from '../models/Agenda';
import Meeting from '../models/Meeting';
import Notification from '../models/Notification';
import User from '../models/User';
import { emitNotification } from '../services/socketService';

export const createAgenda = async (req: Request, res: Response): Promise<void> => {
  try {
    const meetingId = req.params.meetingId;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    const requestingUser = (req as any).user;
    
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Verify user is part of the meeting
    const isParticipant = meeting.participants.some((p: any) => p.user.toString() === requestingUser.id);
    const isOrganizer = meeting.organizerId.toString() === requestingUser.id;
    const isAdmin = requestingUser.role === 'Admin' || requestingUser.role === 'SuperAdmin';

    if (!isParticipant && !isOrganizer && !isAdmin) {
      res.status(403).json({ message: 'You must be invited to this meeting to propose an agenda item' });
      return;
    }

    // Enforce deadline for proposing agenda items
    const meetingDate = new Date(meeting.date);
    const meetingDateStr = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth()+1).padStart(2,'0')}-${String(meetingDate.getDate()).padStart(2,'0')}`;
    const startTimeStr = meeting.startTime || '00:00';
    const meetingStartDateTime = new Date(`${meetingDateStr}T${startTimeStr}:00`);
    const now = new Date();
    
    if (meeting.meetingType === 'Emergency Meeting') {
      if (meetingStartDateTime.getTime() <= now.getTime()) {
        res.status(400).json({ message: 'Agenda items cannot be proposed after the emergency meeting has started.' });
        return;
      }
    } else {
      const hoursDiff = (meetingStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        res.status(400).json({ message: 'Agenda items can only be proposed up to 24 hours before the meeting.' });
        return;
      }
    }

    // All agendas must be explicitly approved, even if created by the organizer
    let status = AgendaStatus.Pending;

    const newAgenda = await Agenda.create({
      ...req.body,
      meetingId,
      proposedBy: requestingUser.id,
      status,
    });

    if (!isOrganizer) {
      const organizer = await User.findById(meeting.organizerId);
      if (
        organizer && 
        organizer.notificationPreferences?.enabled !== false && 
        organizer.notificationPreferences?.agendaUpdates !== false &&
        !organizer.mutedMeetings?.includes(meetingId as any)
      ) {
        const notif = await Notification.create({
          recipient: meeting.organizerId,
          type: 'Agenda Proposed',
          message: `A new agenda item was proposed for: ${meeting.title}`,
          relatedMeeting: meeting._id,
          actionUrl: `/meetings/${meeting._id}`
        }) as any;
        emitNotification(notif.recipient.toString(), notif);
      }
    }

    res.status(201).json(newAgenda);
  } catch (error) {
    res.status(500).json({ message: 'Server error while creating agenda', error });
  }
};

export const getAgendasByMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const agendas = await Agenda.find({ meetingId: req.params.meetingId })
      .populate('proposedBy', 'name email')
      .populate('documents.uploadedBy', 'name email')
      .sort({ sequence: 1, createdAt: 1 });
      
    res.json(agendas);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching agendas', error });
  }
};

export const updateAgendaStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const agendaId = req.params.id;
    const { status } = req.body;

    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const existingAgenda = await Agenda.findById(agendaId);
    if (!existingAgenda) {
      res.status(404).json({ message: 'Agenda not found' });
      return;
    }

    const meeting = await Meeting.findById(existingAgenda.meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the meeting organizer or an admin can update agenda status' });
      return;
    }

    const agenda = await Agenda.findByIdAndUpdate(
      agendaId, 
      { status }, 
      { new: true }
    ).populate('proposedBy', 'name email');

    if (agenda?.proposedBy && agenda.proposedBy._id.toString() !== requestingUser.id) {
      const proposer = await User.findById(agenda.proposedBy._id);
      if (
        proposer && 
        proposer.notificationPreferences?.enabled !== false && 
        proposer.notificationPreferences?.agendaUpdates !== false &&
        !proposer.mutedMeetings?.includes(agenda.meetingId as any)
      ) {
        const notif = await Notification.create({
          recipient: agenda.proposedBy._id,
          type: `Agenda ${status}`,
          message: `Your proposed agenda item was ${status.toLowerCase()}`,
          relatedMeeting: agenda.meetingId,
          actionUrl: `/meetings/${agenda.meetingId}`
        }) as any;
        emitNotification(notif.recipient.toString(), notif);
      }
    }

    res.json(agenda);
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating agenda status', error });
  }
};

export const deleteAgenda = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const existingAgenda = await Agenda.findById(req.params.id);
    if (!existingAgenda) {
      res.status(404).json({ message: 'Agenda not found' });
      return;
    }

    const meeting = await Meeting.findById(existingAgenda.meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    const isProposer = existingAgenda.proposedBy.toString() === requestingUser.id;
    const isOrganizer = meeting.organizerId.toString() === requestingUser.id;
    const isAdmin = requestingUser.role === 'Admin' || requestingUser.role === 'SuperAdmin';

    if (!isProposer && !isOrganizer && !isAdmin) {
      res.status(403).json({ message: 'You do not have permission to delete this agenda item' });
      return;
    }

    await Agenda.findByIdAndDelete(req.params.id);
    res.json({ message: 'Agenda item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while deleting agenda', error });
  }
};

export const reorderAgendas = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Invalid payload format' });
      return;
    }

    const sampleAgenda = await Agenda.findById(items[0].id);
    if (!sampleAgenda) {
      res.status(404).json({ message: 'Agenda not found' });
      return;
    }

    const meeting = await Meeting.findById(sampleAgenda.meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the meeting organizer or an admin can reorder agendas' });
      return;
    }

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { sequence: item.sequence }
      }
    }));

    await Agenda.bulkWrite(bulkOps);

    res.json({ message: 'Agendas reordered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while reordering agendas', error });
  }
};
