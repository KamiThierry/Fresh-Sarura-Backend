import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    declareHarvest,
    getHarvestDeclarations,
    logPickup,
    getIntakeLogs,
} from '../controllers/harvestController.js';

const router = express.Router();
router.use(protect);

router.post('/', restrictTo('farm_manager'), declareHarvest);
router.get('/', restrictTo('logistic_officer', 'production_manager', 'quality_officer', 'admin'), getHarvestDeclarations);
router.get('/intake-logs', restrictTo('production_manager', 'quality_officer', 'admin'), getIntakeLogs);
router.patch('/:id/pickup', restrictTo('logistic_officer'), logPickup);

export default router;