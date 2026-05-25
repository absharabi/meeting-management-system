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

    const requestingUser = (req as any).user || { id: '65f0a1b2c3d4e5f607890abc' }; // Mock user
    
    // Determine status: if organizer creates it, auto-approve. If participant creates it, it's pending.
    let status = AgendaStatus.Pending;
    if (meeting.organizerId.toString() === requestingUser.id) {
      status = AgendaStatus.Approved;
    }

    const newAgenda = await Agenda.create({
      ...req.body,
      meetingId,
      proposedBy: requestingUser.id,
      status,
    });

    if (meeting.organizerId.toString() !== requestingUser.id) {
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
          relatedMeeting: meetingId,
          actionUrl: `/meetings/${meetingId}`
        });
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

    const agenda = await Agenda.findByIdAndUpdate(
      agendaId, 
      { status }, 
      { new: true }
    ).populate('proposedBy', 'name email');

    if (!agenda) {
      res.status(404).json({ message: 'Agenda not found' });
      return;
    }

    const requestingUser = (req as any).user || { id: '65f0a1b2c3d4e5f607890abc' };
    if (agenda.proposedBy && agenda.proposedBy._id.toString() !== requestingUser.id) {
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
        });
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
    const deleted = await Agenda.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Agenda not found' });
      return;
    }
    res.json({ message: 'Agenda item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while deleting agenda', error });
  }
};

export const reorderAgendas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body; // array of { id: string, sequence: number }
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ message: 'Invalid payload format' });
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
