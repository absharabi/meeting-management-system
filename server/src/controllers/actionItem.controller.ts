import { Request, Response } from 'express';
import ActionItem from '../models/ActionItem';
import Meeting from '../models/Meeting';
import mongoose from 'mongoose';
import { isMeetingCancelled, rejectCancelledMeeting } from '../utils/meetingState';
import { hasAcceptedParticipantAccess } from '../utils/meetingAccess';

export const createActionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { title, description, meetingId, assigneeId, dueDate } = req.body;
    
    // Quick validation
    if (!title || !meetingId || !assigneeId) {
      res.status(400).json({ message: 'Title, meetingId, and assigneeId are required' });
      return;
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (rejectCancelledMeeting(res, meeting)) return;

    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the meeting organizer or an admin can create action items' });
      return;
    }

    const actionItem = await ActionItem.create({
      title,
      description,
      meetingId,
      assigneeId,
      dueDate
    });

    res.status(201).json(actionItem);
  } catch (error) {
    res.status(500).json({ message: 'Error creating action item', error });
  }
};

export const getMyActionItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    
    const items = await ActionItem.find({ assigneeId: requestingUser.id })
      .populate('meetingId', 'title date status')
      .sort({ dueDate: 1 });
      
    res.status(200).json(items.filter((item: any) => !isMeetingCancelled(item.meetingId)));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching action items', error });
  }
};

export const getMeetingActionItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (rejectCancelledMeeting(res, meeting)) return;

    const items = await ActionItem.find({ meetingId })
      .populate('assigneeId', 'name email')
      .sort({ createdAt: -1 });
      
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meeting action items', error });
  }
};

export const updateActionItemStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { id } = req.params;
    const { status } = req.body;

    const existingItem = await ActionItem.findById(id).populate('meetingId');
    if (!existingItem) {
      res.status(404).json({ message: 'Action item not found' });
      return;
    }

    const meeting = existingItem.meetingId as any;
    if (rejectCancelledMeeting(res, meeting)) return;

    if (
      existingItem.assigneeId.toString() !== requestingUser.id &&
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'You do not have permission to update this action item' });
      return;
    }
    if (
      existingItem.assigneeId.toString() === requestingUser.id &&
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin' &&
      !hasAcceptedParticipantAccess(meeting, requestingUser.id)
    ) {
      res.status(403).json({ message: 'Please accept the meeting invitation before updating assigned action items.' });
      return;
    }

    const item = await ActionItem.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    ).populate('meetingId', 'title');

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating action item', error });
  }
};

export const deleteActionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    const { id } = req.params;
    
    const existingItem = await ActionItem.findById(id).populate('meetingId');
    if (!existingItem) {
      res.status(404).json({ message: 'Action item not found' });
      return;
    }

    const meeting = existingItem.meetingId as any;
    if (rejectCancelledMeeting(res, meeting)) return;

    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the meeting organizer or an admin can delete action items' });
      return;
    }

    await ActionItem.findByIdAndDelete(id);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting action item', error });
  }
};
