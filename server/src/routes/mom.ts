import express from 'express';
import { approveMom, exportMom, getMom, patchMom, saveMom } from '../controllers/momController';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Apply authentication to all MoM routes
router.use(protect);

router.get('/:id/mom', getMom);
router.post('/:id/mom', saveMom);
router.patch('/:id/mom', patchMom);
router.post('/:id/mom/approve', approveMom);
router.get('/:id/mom/export', exportMom);

export default router;
