import express from 'express';
import { exportMom, getMom, patchMom, saveMom } from '../controllers/momController';

const router = express.Router();

router.get('/:id/mom', getMom);
router.post('/:id/mom', saveMom);
router.patch('/:id/mom', patchMom);
router.get('/:id/mom/export', exportMom);

export default router;
