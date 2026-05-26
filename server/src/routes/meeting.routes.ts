import express from 'express';
import { 
  createMeeting, 
  getMeetings, 
  updateMeeting, 
  deleteMeeting, 
  markAttendance,
  rsvpMeeting
} from '../controllers/meeting.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// All meeting routes require authentication
router.use(protect);

// CRUD Routes
router.post('/', createMeeting);
router.get('/', getMeetings);
router.put('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);

// Specific Feature Routes
router.post('/:id/attendance', markAttendance);
router.post('/:id/rsvp', rsvpMeeting);

import agendaRoutes from './agenda.routes';

// Agenda Routes
router.use('/:meetingId/agendas', agendaRoutes);

export default router;
