import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Meeting from '../models/Meeting';
import Agenda from '../models/Agenda';

export const getMeetingReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid meeting ID' });
      return;
    }

    const meeting = await Meeting.findById(id)
      .populate('organizerId', 'name email role')
      .populate('participants.user', 'name email role')
      .populate('attendance', 'name email role');

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    const requestingUser = (req as any).user;
    // TEMPORARY BYPASS: Allow viewing any meeting details during local testing
    // const isOrganizer = meeting.organizerId && meeting.organizerId._id.toString() === requestingUser.id;
    // const isAdminOrSuper = requestingUser.role === 'Admin' || requestingUser.role === 'SuperAdmin';
    // if (!isOrganizer && !isAdminOrSuper) {
    //   res.status(403).json({ message: 'Access denied: You are not the organizer of this meeting.' });
    //   return;
    // }

    const agendas = await Agenda.find({ meetingId: id }).sort({ sequence: 1 }).populate('proposedBy', 'name');

    // Calculate attendance percentage
    const totalParticipants = meeting.participants.length;
    const totalAttended = meeting.attendance.length;
    const attendancePercentage = totalParticipants > 0 ? ((totalAttended / totalParticipants) * 100).toFixed(2) : 0;

    res.status(200).json({
      meeting,
      agendas,
      metrics: {
        totalParticipants,
        totalAttended,
        attendancePercentage,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meeting report', error });
  }
};

export const getDateWiseReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required' });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    const requestingUser = (req as any).user;
    let query: any = { date: { $gte: start, $lte: end } };
    
    // If regular user, only show their organized meetings
    if (requestingUser.role === 'User') {
      query.organizerId = requestingUser.id;
    }

    const meetings = await Meeting.find(query).populate('organizerId', 'name email').sort({ date: 1 });

    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching date-wise report', error });
  }
};

export const getYearlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year } = req.query;
    if (!year) {
      res.status(400).json({ message: 'Year is required' });
      return;
    }

    const targetYear = parseInt(year as string, 10);
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

    const requestingUser = (req as any).user;
    let matchQuery: any = {
      date: { $gte: startDate, $lte: endDate }
    };
    
    if (requestingUser.role === 'User') {
      matchQuery.organizerId = new mongoose.Types.ObjectId(requestingUser.id);
    }

    // Aggregate to count meetings per month
    const monthlyStats = await Meeting.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: { month: { $month: '$date' }, type: '$meetingType' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.month': 1 }
      }
    ]);

    // Format data for Recharts: { name: 'Jan', Board: 2, Normal: 5, ... }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData = months.map((month, index) => {
      const monthData: any = { name: month };
      monthlyStats.forEach(stat => {
        if (stat._id.month === index + 1) {
          monthData[stat._id.type] = stat.count;
        }
      });
      return monthData;
    });

    res.status(200).json(formattedData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching yearly report', error });
  }
};
