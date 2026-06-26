import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { getStock } from '../controllers/harvestController.js';

const router = express.Router();
router.use(protect);
router.get('/', restrictTo('production_manager', 'quality_officer', 'admin'), getStock);

export default router;