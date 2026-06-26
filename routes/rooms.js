import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { getRooms, createRoom, updateRoom, expandCapacity, clearRoom, getRoomBatches } from '../controllers/roomController.js';

const router = express.Router();
router.use(protect);

router.get('/', restrictTo('production_manager', 'quality_officer', 'admin'), getRooms);
router.post('/', restrictTo('production_manager', 'admin'), createRoom);
router.patch('/:id', restrictTo('production_manager', 'admin'), updateRoom);
router.patch('/:id/expand', restrictTo('production_manager', 'admin'), expandCapacity);
router.patch('/:id/clear', restrictTo('production_manager', 'admin'), clearRoom);
router.get('/:id/batches', restrictTo('production_manager', 'admin'), getRoomBatches);

export default router;
