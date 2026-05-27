import { Router } from 'express';
import multer from 'multer';
import { protect, authorize } from '../middleware/auth.middleware';
import { Role } from '../models/User';
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  bulkAddUsers,
  updatePreferences,
  toggleMuteMeeting,
  getMe,
  updateMyProfile
} from '../controllers/user.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Ensure all routes below are protected
router.use(protect);

// Current User (auth bypassed for dev)
router.get('/me', getMe);
router.put('/me', updateMyProfile);

// Notification Preferences (Any logged-in user - auth bypassed for dev)
router.put('/preferences', updatePreferences);
router.put('/mute-meeting/:meetingId', toggleMuteMeeting);

// Any authenticated user needs to be able to get users for meeting invitations
router.get('/', getUsers);

// The following user management routes are restricted to Admins only
router.use(authorize(Role.SuperAdmin, Role.Admin));

router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/bulk', upload.single('file'), bulkAddUsers);

export default router;
