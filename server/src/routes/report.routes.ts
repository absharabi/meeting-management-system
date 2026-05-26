import { Router } from 'express';
import { getMeetingReport, getDateWiseReport, getYearlyReport } from '../controllers/report.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Protect all report routes
router.use(protect);

// Global reports: Allowed for regular users too (filtering is done in the controller)
router.get('/date-wise', getDateWiseReport);
router.get('/yearly', getYearlyReport);

// Meeting-wise report: Admins, SuperAdmins, and the Meeting Organizer (checked in controller)
router.get('/meeting/:id', getMeetingReport);

export default router;
