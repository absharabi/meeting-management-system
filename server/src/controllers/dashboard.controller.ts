import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ActionItem, { ActionItemStatus } from '../models/ActionItem';
import Meeting, { MeetingStatus } from '../models/Meeting';
import User, { Role } from '../models/User';

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value);

const formatPercentage = (value: number) => `${Math.round(value)}%`;

const mergeQuery = (scope: any, extra: any = {}) => {
  const hasScope = Object.keys(scope).length > 0;
  const hasExtra = Object.keys(extra).length > 0;
  if (!hasScope) return extra;
  if (!hasExtra) return scope;
  return { $and: [scope, extra] };
};

const daysAgoLabel = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getWeekRange = () => {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const end = endOfDay(new Date(start));
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const getMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  return { start, end };
};

const buildMeetingScope = async (userId: string, role: string) => {
  if (role === Role.SuperAdmin) return {};

  if (role === Role.Admin) {
    const user = await User.findById(userId).select('department');
    if (!user?.department) return {};

    const departmentUsers = await User.find({ department: user.department }).select('_id');
    const departmentUserIds = departmentUsers.map((item) => item._id);
    return {
      $or: [
        { organizerId: { $in: departmentUserIds } },
        { 'participants.user': { $in: departmentUserIds } },
      ],
    };
  }

  return {
    $or: [
      { organizerId: userId },
      { 'participants.user': userId },
      { visibility: 'Public' },
    ],
  };
};

const countMeetings = (scope: any, extra: any = {}) => Meeting.countDocuments(mergeQuery(scope, extra));

const calculateAttendanceAverage = async (scope: any) => {
  const result = await Meeting.aggregate([
    { $match: mergeQuery(scope, { status: MeetingStatus.Completed }) },
    {
      $group: {
        _id: null,
        expected: { $sum: { $size: { $ifNull: ['$participants', []] } } },
        attended: { $sum: { $size: { $ifNull: ['$attendance', []] } } },
      },
    },
  ]);

  const totals = result[0] || { expected: 0, attended: 0 };
  return totals.expected === 0 ? 0 : (totals.attended / totals.expected) * 100;
};

const buildChartData = async (scope: any) => {
  const { start, end } = getWeekRange();
  const meetings = await Meeting.find(mergeQuery(scope, { date: { $gte: start, $lte: end } })).select('date');
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return labels.map((name, index) => ({
    name,
    meetings: meetings.filter((meeting) => new Date(meeting.date).getDay() === index).length,
  }));
};

const buildCalendarMeetings = async (scope: any) => {
  const { start, end } = getMonthRange();
  const meetings = await Meeting.find(mergeQuery(scope, { date: { $gte: start, $lte: end } }))
    .select('title date status')
    .sort({ date: 1, startTime: 1 })
    .limit(100);

  return meetings.map((meeting) => ({
    id: meeting._id.toString(),
    title: meeting.title,
    date: meeting.date,
    status: meeting.status,
  }));
};

const buildActivityLogs = async (scope: any, role: string) => {
  const meetings = await Meeting.find(scope)
    .select('title createdAt updatedAt status')
    .sort({ updatedAt: -1 })
    .limit(6);

  const meetingLogs = meetings.map((meeting) => ({
    id: `meeting-${meeting._id}`,
    action: meeting.status === MeetingStatus.Cancelled ? 'Meeting Cancelled' : 'Meeting Updated',
    details: meeting.title,
    time: daysAgoLabel(meeting.updatedAt),
    type: 'meeting',
  }));

  if (role !== Role.SuperAdmin) return meetingLogs;

  const users = await User.find().select('name role createdAt').sort({ createdAt: -1 }).limit(4);
  const userLogs = users.map((user) => ({
    id: `user-${user._id}`,
    action: 'User Added',
    details: `${user.name} joined as ${user.role}`,
    time: daysAgoLabel(user.createdAt),
    type: 'user',
  }));

  return [...meetingLogs, ...userLogs]
    .sort((a, b) => {
      const aDate = a.id.startsWith('meeting-')
        ? meetings.find((item) => `meeting-${item._id}` === a.id)?.updatedAt
        : users.find((item) => `user-${item._id}` === a.id)?.createdAt;
      const bDate = b.id.startsWith('meeting-')
        ? meetings.find((item) => `meeting-${item._id}` === b.id)?.updatedAt
        : users.find((item) => `user-${item._id}` === b.id)?.createdAt;
      return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime();
    })
    .slice(0, 6);
};

const buildStats = async (scope: any, role: string, userId: string) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const upcomingFilter = { date: { $gte: todayStart }, status: { $ne: MeetingStatus.Cancelled } };

  if (role === Role.SuperAdmin) {
    const [totalMeetings, activeUsers, pendingMeetings, todayMeetings, monthlyReports] = await Promise.all([
      countMeetings(scope),
      User.countDocuments({ isActive: true }),
      countMeetings(scope, { status: MeetingStatus.Scheduled }),
      countMeetings(scope, { date: { $gte: todayStart, $lte: todayEnd } }),
      countMeetings(scope, {
        date: { $gte: monthStart, $lte: monthEnd },
        $or: [{ offlineReportFileUrl: { $ne: null } }, { status: MeetingStatus.Completed }],
      }),
    ]);

    return [
      { id: 1, title: 'Total Meetings', value: formatNumber(totalMeetings), description: 'Created in the system' },
      { id: 2, title: 'Active Users', value: formatNumber(activeUsers), description: 'Currently enabled accounts' },
      { id: 3, title: 'Scheduled Meetings', value: formatNumber(pendingMeetings), description: 'Not completed or cancelled' },
      { id: 4, title: "Today's Meetings", value: formatNumber(todayMeetings), description: 'System-wide today' },
      { id: 5, title: 'Monthly Reports', value: formatNumber(monthlyReports), description: 'Completed or report-attached meetings' },
    ];
  }

  if (role === Role.Admin) {
    const user = await User.findById(userId).select('department');
    const departmentUserCount = user?.department ? await User.countDocuments({ department: user.department, isActive: true }) : 0;
    const [upcomingMeetings, pendingResponses, attendanceAverage, activeOrganizers] = await Promise.all([
      countMeetings(scope, upcomingFilter),
      Meeting.countDocuments(mergeQuery(scope, { 'participants.status': 'Pending' })),
      calculateAttendanceAverage(scope),
      Meeting.distinct('organizerId', scope).then((items) => items.length),
    ]);

    return [
      { id: 1, title: 'Upcoming Meetings', value: formatNumber(upcomingMeetings), description: 'In your department scope' },
      { id: 2, title: 'Pending RSVPs', value: formatNumber(pendingResponses), description: 'Participant responses pending' },
      { id: 3, title: 'Attendance Avg', value: formatPercentage(attendanceAverage), description: 'Completed meetings' },
      { id: 4, title: 'Active Organizers', value: formatNumber(activeOrganizers || departmentUserCount), description: 'Users scheduling meetings' },
    ];
  }

  const objectUserId = new mongoose.Types.ObjectId(userId);
  const [organized, upcomingParticipations, pendingInvitations, attendanceAverage, openActionItems] = await Promise.all([
    Meeting.countDocuments({ organizerId: userId }),
    Meeting.countDocuments({ 'participants.user': userId, ...upcomingFilter }),
    Meeting.countDocuments({ participants: { $elemMatch: { user: objectUserId, status: 'Pending' } } }),
    calculateAttendanceAverage({ attendance: userId }),
    ActionItem.countDocuments({ assigneeId: userId, status: { $ne: ActionItemStatus.DONE } }),
  ]);

  return [
    { id: 1, title: 'Meetings Organized', value: formatNumber(organized), description: 'Created by you' },
    { id: 2, title: 'Upcoming Participations', value: formatNumber(upcomingParticipations), description: 'Scheduled from today onward' },
    { id: 3, title: 'Pending Invitations', value: formatNumber(pendingInvitations), description: 'Requires RSVP' },
    { id: 4, title: 'Open Action Items', value: formatNumber(openActionItems), description: 'Assigned to you' },
    { id: 5, title: 'Attendance', value: formatPercentage(attendanceAverage), description: 'Completed meetings attended' },
  ];
};

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestingUser = (req as any).user;
    if (!requestingUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const scope = await buildMeetingScope(requestingUser.id, requestingUser.role);
    const [stats, chartData, calendarMeetings, activityLogs] = await Promise.all([
      buildStats(scope, requestingUser.role, requestingUser.id),
      buildChartData(scope),
      buildCalendarMeetings(scope),
      buildActivityLogs(scope, requestingUser.role),
    ]);

    res.json({
      stats,
      chartData,
      calendarMeetings,
      activityLogs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading dashboard summary', error });
  }
};
