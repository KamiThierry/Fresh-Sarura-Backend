import express from 'express';
import { submitMessage, getMessages, markAsRead, replyToMessage, deleteMessage } from '../controllers/contactController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public — landing page form submission
router.post('/', submitMessage);

// Admin only
router.get('/',           protect, restrictTo('admin'), getMessages);
router.patch('/:id/read', protect, restrictTo('admin'), markAsRead);
router.post('/:id/reply', protect, restrictTo('admin'), replyToMessage);
router.delete('/:id',     protect, restrictTo('admin'), deleteMessage);

export default router;
