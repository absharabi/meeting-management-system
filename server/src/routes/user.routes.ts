import { Router } from 'express';
import multer from 'multer';
import { protect, authorize } from '../middleware/auth.middleware';
import { Role } from '../models/User';
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  bulkAddUsers
} from '../controllers/user.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protect all user management routes
router.use(protect);
router.use(authorize(Role.SuperAdmin, Role.Admin));

router.get('/', getUsers);
router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/bulk', upload.single('file'), bulkAddUsers);

export default router;
