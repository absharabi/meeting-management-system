import { Request, Response } from 'express';
import Notification from '../models/Notification';

// Temporary dummy user fallback for bypass
const getRequestingUser = (req: Request) => {
  return (req as any).user;
};

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = getRequestingUser(req);

    const notifications = await Notification.find({ recipient: requestingUser.id })
      .sort({ createdAt: -1 })
      .limit(50); // Fetch last 50 for performance

    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = getRequestingUser(req);

    await Notification.updateMany(
      { recipient: requestingUser.id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications as read', error });
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndDelete(id);
    
    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error });
  }
};

export const clearAllNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = getRequestingUser(req);
    await Notification.deleteMany({ recipient: requestingUser.id });
    res.status(200).json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing notifications', error });
  }
};
