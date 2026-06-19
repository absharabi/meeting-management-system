import { Response } from 'express';
import { MeetingStatus } from '../models/Meeting';

export const CANCELLED_MEETING_MESSAGE =
  'This meeting has been cancelled. Attendance, agendas, MoM, reports, uploads, and action items are locked.';

export const isMeetingCancelled = (meeting: any): boolean =>
  meeting?.status === MeetingStatus.Cancelled || meeting?.status === 'Cancelled';

export const rejectCancelledMeeting = (res: Response, meeting: any): boolean => {
  if (!isMeetingCancelled(meeting)) return false;
  res.status(409).json({ message: CANCELLED_MEETING_MESSAGE });
  return true;
};
