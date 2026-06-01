import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);
router.get('/summary', getDashboardSummary);

export default router;
