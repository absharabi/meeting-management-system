import { Router } from 'express';
import { createActionItem, getMyActionItems, getMeetingActionItems, updateActionItemStatus, deleteActionItem } from '../controllers/actionItem.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', createActionItem);
router.get('/me', getMyActionItems);
router.get('/meeting/:meetingId', getMeetingActionItems);
router.put('/:id/status', updateActionItemStatus);
router.delete('/:id', deleteActionItem);

export default router;
