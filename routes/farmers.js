import express from 'express';
import { getFarmers, registerFarmer, updateFarmer, deleteFarmer, suspendFarmer, reactivateFarmer } from '../controllers/farmerController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes protected — PM and Admin only
router.use(protect);
// Index route open to more roles for search/visibility
router.get('/', restrictTo('production_manager', 'admin', 'logistic_officer', 'quality_officer'), getFarmers);

// Management routes restricted to PM and Admin
router.use(restrictTo('production_manager', 'admin'));

router.post('/', registerFarmer);
router.patch('/:id', updateFarmer);
router.patch('/:id/suspend', suspendFarmer);
router.patch('/:id/reactivate', reactivateFarmer);
router.delete('/:id', deleteFarmer);

export default router;