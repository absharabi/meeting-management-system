import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Feedback from '../models/Feedback';

export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meetingId, rating, comment } = req.body;
    const requestingUser = (req as any).user;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Rating must be between 1 and 5' });
      return;
    }

    // Upsert feedback
    const feedback = await Feedback.findOneAndUpdate(
      { meetingId, userId: requestingUser.id },
      { rating, comment },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Feedback submitted successfully', feedback });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting feedback', error });
  }
};

export const getMeetingFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }

    const feedbacks = await Feedback.find({ meetingId }).populate('userId', 'name avatar');
    
    const totalFeedbacks = feedbacks.length;
    const averageRating = totalFeedbacks > 0 
      ? (feedbacks.reduce((acc, curr) => acc + curr.rating, 0) / totalFeedbacks).toFixed(1) 
      : 0;

    res.status(200).json({
      averageRating,
      totalFeedbacks,
      feedbacks,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meeting feedback', error });
  }
};
