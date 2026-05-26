import { Request, Response } from 'express';
import ActionItem from '../models/ActionItem';
import Meeting from '../models/Meeting';
import mongoose from 'mongoose';

export const createActionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, meetingId, assigneeId, dueDate } = req.body;
    
    // Quick validation
    if (!title || !meetingId || !assigneeId) {
      res.status(400).json({ message: 'Title, meetingId, and assigneeId are required' });
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
      .populate('meetingId', 'title date')
      .sort({ dueDate: 1 });
      
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching action items', error });
  }
};

export const getMeetingActionItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meetingId } = req.params;
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
    const { id } = req.params;
    const { status } = req.body;

    const item = await ActionItem.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    ).populate('meetingId', 'title');

    if (!item) {
      res.status(404).json({ message: 'Action item not found' });
      return;
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating action item', error });
  }
};

export const deleteActionItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await ActionItem.findByIdAndDelete(id);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting action item', error });
  }
};
