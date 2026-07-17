import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    getPackagingSummary,
    getAllPackagingStock,
    receivePackagingStock,
    restockPackagingStock,
    consumePackagingStock,
    updatePackagingStock,
    deletePackagingStock,
} from '../controllers/packagingController.js';

const router = express.Router();
router.use(protect);

router.get('/summary', getPackagingSummary);
router.get('/', restrictTo('production_manager', 'admin'), getAllPackagingStock);
router.post('/', restrictTo('production_manager', 'admin'), receivePackagingStock);
router.patch('/consume', restrictTo('production_manager', 'admin'), consumePackagingStock);
router.patch('/:id/restock', restrictTo('production_manager', 'admin'), restockPackagingStock);
router.patch('/:id', restrictTo('production_manager', 'admin'), updatePackagingStock);
router.delete('/:id', restrictTo('production_manager', 'admin'), deletePackagingStock);

export default router;

