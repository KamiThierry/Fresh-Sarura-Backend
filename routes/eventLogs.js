import express from 'express';
import { getAllLogs } from '../controllers/eventLogController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', getAllLogs);

export default router;
