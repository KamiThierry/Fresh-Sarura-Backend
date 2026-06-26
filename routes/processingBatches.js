import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    requestRoom,
    getPendingRoomRequests,
    assignRoom,
    completeBatch,
    getMyBatches,
    getAllBatches,
    confirmBatch,
    spoilBatch,
} from '../controllers/harvestController.js';

const router = express.Router();
router.use(protect);

router.get('/', restrictTo('production_manager', 'admin'), getAllBatches);
router.post('/', restrictTo('quality_officer', 'admin'), requestRoom);
router.get('/my', restrictTo('quality_officer', 'admin'), getMyBatches);
router.get('/pending-room', restrictTo('production_manager', 'admin'), getPendingRoomRequests);
router.patch('/:id/assign-room', restrictTo('production_manager', 'admin'), assignRoom);
router.patch('/:id/complete', restrictTo('quality_officer', 'admin'), completeBatch);
router.patch('/:id/confirm', restrictTo('production_manager', 'admin'), confirmBatch);
router.patch('/:id/spoil', restrictTo('production_manager', 'admin'), spoilBatch);

export default router;