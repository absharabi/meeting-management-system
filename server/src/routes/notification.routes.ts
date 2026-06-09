import express from 'express';
import { 
  getUserNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  clearAllNotifications,
  clearDropdownNotification,
  clearAllDropdownNotifications
} from '../controllers/notification.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get('/', getUserNotifications);
router.put('/read-all', markAllAsRead);
router.delete('/clear-all', clearAllNotifications);
router.put('/clear-all-dropdown', clearAllDropdownNotifications);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);
router.put('/:id/clear-dropdown', clearDropdownNotification);

export default router;
