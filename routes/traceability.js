import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { getTraceabilityData } from '../controllers/traceabilityController.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('production_manager', 'admin', 'logistic_officer'));

router.get('/:id', getTraceabilityData);

export default router;
