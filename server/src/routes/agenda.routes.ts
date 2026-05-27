import express from 'express';
import { 
  createAgenda, 
  getAgendasByMeeting, 
  updateAgendaStatus, 
  deleteAgenda,
  reorderAgendas
} from '../controllers/agenda.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router({ mergeParams: true });

// Protect all agenda routes
router.use(protect);

// Agenda routes mounted under /api/meetings/:meetingId/agendas
router.put('/reorder', reorderAgendas);
router.post('/', createAgenda);
router.get('/', getAgendasByMeeting);
router.put('/:id/status', updateAgendaStatus);
router.delete('/:id', deleteAgenda);

export default router;
