import express from 'express';
import { 
  createMeeting, 
  getMeetings, 
  updateMeeting, 
  deleteMeeting,
  hardDeleteMeeting,
  markAttendance,
  rsvpMeeting,
  approveNominee,
  rejectNominee,
  searchMeetings
} from '../controllers/meeting.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// All meeting routes require authentication
router.use(protect);

// CRUD Routes
router.get('/search', searchMeetings);
router.post('/', createMeeting);
router.get('/', getMeetings);
router.put('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);
router.delete('/:id/hard', hardDeleteMeeting);

// Specific Feature Routes
router.post('/:id/attendance', markAttendance);
router.put('/:id/rsvp', rsvpMeeting);
router.put('/:id/nominees/:participantId/approve', approveNominee);
router.put('/:id/nominees/:participantId/reject', rejectNominee);


import agendaRoutes from './agenda.routes';

// Agenda Routes
router.use('/:meetingId/agendas', agendaRoutes);

export default router;
