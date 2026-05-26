import { Router } from 'express';
import { submitFeedback, getMeetingFeedback } from '../controllers/feedback.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', submitFeedback);
router.get('/:meetingId', getMeetingFeedback);

export default router;
