import express from 'express';
import { getActivityStats, getCycleStats, getRecentActivity } from '../controllers/adminController.js';

const router = express.Router();

router.get('/stats/activity', getActivityStats);
router.get('/stats/cycles', getCycleStats);
router.get('/activity/recent', getRecentActivity);

export default router;
