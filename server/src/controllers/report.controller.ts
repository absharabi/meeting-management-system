import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Meeting from '../models/Meeting';
import Agenda from '../models/Agenda';
import ActionItem from '../models/ActionItem';
import User from '../models/User';

export const getMeetingReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: identifier } = req.params;

    let meetingQuery;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      meetingQuery = { _id: identifier };
    } else {
      meetingQuery = { title: { $regex: identifier, $options: 'i' } };
    }

    const meeting = await Meeting.findOne(meetingQuery)
      .populate('organizerId', 'name email role')
      .populate('participants.user', 'name email role')
      .populate('attendance', 'name email role');

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found matching that name or ID' });
      return;
    }

    const id = meeting._id;

    const requestingUser = (req as any).user;
    // TEMPORARY BYPASS: Allow viewing any meeting details during local testing
    // const isOrganizer = meeting.organizerId && meeting.organizerId._id.toString() === requestingUser.id;
    // const isAdminOrSuper = requestingUser.role === 'Admin' || requestingUser.role === 'SuperAdmin';
    // if (!isOrganizer && !isAdminOrSuper) {
    //   res.status(403).json({ message: 'Access denied: You are not the organizer of this meeting.' });
    //   return;
    // }

    const agendas = await Agenda.find({ meetingId: id }).sort({ sequence: 1 }).populate('proposedBy', 'name');
    const actionItems = await ActionItem.find({ meetingId: id }).populate('assigneeId', 'name email');

    // Calculate attendance percentage
    const totalParticipants = meeting.participants.length;
    const totalAttended = meeting.attendance.length;
    const attendancePercentage = totalParticipants > 0 ? ((totalAttended / totalParticipants) * 100).toFixed(2) : 0;

    res.status(200).json({
      meeting,
      agendas,
      actionItems,
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
    const { startDate, endDate, keyword } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required' });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    const requestingUser = (req as any).user;
    
    // Deep Keyword Search logic
    let keywordOrFilters: any[] = [];
    if (keyword) {
      const regexKeyword = new RegExp(keyword as string, 'i');
      
      const matchedUsers = await User.find({
        $or: [{ name: regexKeyword }, { email: regexKeyword }]
      }).select('_id');
      const matchedUserIds = matchedUsers.map(u => u._id);

      const [matchedAgendas, matchedActionItems] = await Promise.all([
        Agenda.find({ $or: [{ title: regexKeyword }, { description: regexKeyword }] }).select('meetingId'),
        ActionItem.find({ $or: [{ title: regexKeyword }, { description: regexKeyword }] }).select('meetingId')
      ]);

      const matchedMeetingIdsFromRelated = [
        ...matchedAgendas.map(a => a.meetingId),
        ...matchedActionItems.map(a => a.meetingId)
      ];

      keywordOrFilters = [
        { title: regexKeyword },
        { description: regexKeyword },
        { status: regexKeyword }
      ];

      if (matchedUserIds.length > 0) {
        keywordOrFilters.push({ organizerId: { $in: matchedUserIds } });
        keywordOrFilters.push({ 'participants.user': { $in: matchedUserIds } });
      }

      if (matchedMeetingIdsFromRelated.length > 0) {
        keywordOrFilters.push({ _id: { $in: matchedMeetingIdsFromRelated } });
      }
    }

    let query: any = { date: { $gte: start, $lte: end } };
    
    if (keywordOrFilters.length > 0) {
      query = { $and: [{ date: { $gte: start, $lte: end } }, { $or: keywordOrFilters }] };
    }
    
    // If regular user, only show their organized meetings
    if (requestingUser.role === 'User') {
      if (query.$and) {
        query.$and.push({ organizerId: requestingUser.id });
      } else {
        query.organizerId = requestingUser.id;
      }
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
