import { Request, Response } from 'express';
import Meeting, { MeetingMode, MeetingStatus } from '../models/Meeting';
import { Role } from '../models/User';

// Helper to check if a user has permission to create/edit meetings
const canManageMeetings = (role: string) => {
  return [Role.SuperAdmin, Role.Admin, Role.Organizer].includes(role as Role);
};

export const createMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    // TEMPORARY: Dummy user since auth is bypassed
    const requestingUser = (req as any).user || { id: '65f0a1b2c3d4e5f607890abc', role: Role.SuperAdmin };
    
    // RBAC: Only authorized roles can create meetings
    if (!canManageMeetings(requestingUser.role)) {
      res.status(403).json({ message: 'You do not have permission to create meetings' });
      return;
    }

    const { date, startTime, endTime, venue, mode } = req.body;

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

    // Assign the creator as the organizer
    const newMeeting = await Meeting.create({
      ...req.body,
      organizerId: requestingUser.id,
    });

    res.status(201).json(newMeeting);
  } catch (error) {
    res.status(500).json({ message: 'Server error while creating meeting', error });
  }
};

export const getMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyword, status, date, venue } = req.query;
    
    // Build an advanced search query object
    let query: any = {};

    // Keyword Search (searches title and description)
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword as string, $options: 'i' } },
        { description: { $regex: keyword as string, $options: 'i' } }
      ];
    }

    // Status Filter
    if (status) query.status = status;

    // Date Filter
    if (date) query.date = new Date(date as string);

    // Venue Filter
    if (venue) query.venue = venue;

    const meetings = await Meeting.find(query)
      .populate('organizerId', 'name email')
      .populate('participants', 'name email department')
      .sort({ date: 1, startTime: 1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching meetings', error });
  }
};

export const updateMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user || { id: '65f0a1b2c3d4e5f607890abc', role: Role.SuperAdmin };
    
    if (!canManageMeetings(requestingUser.role)) {
      res.status(403).json({ message: 'You do not have permission to edit meetings' });
      return;
    }

    const meetingId = req.params.id;
    const target = await Meeting.findById(meetingId);
    
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    // Venue Conflict Detection for Updates
    const { date, startTime, endTime, venue, mode } = req.body;
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

    const updated = await Meeting.findByIdAndUpdate(meetingId, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating meeting', error });
  }
};

export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user || { id: '65f0a1b2c3d4e5f607890abc', role: Role.SuperAdmin };
    
    if (!canManageMeetings(requestingUser.role)) {
      res.status(403).json({ message: 'You do not have permission to delete meetings' });
      return;
    }

    const deleted = await Meeting.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json({ message: 'Meeting successfully deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while deleting meeting', error });
  }
};

export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    
    if (!canManageMeetings(requestingUser.role)) {
      res.status(403).json({ message: 'Only organizers/admins can mark attendance' });
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
