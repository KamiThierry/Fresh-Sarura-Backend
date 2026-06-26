import express from 'express';
import {
    getCropVarieties,
    getAllCropVarieties,
    createCropVariety,
    updateCropVariety,
    deleteCropVariety
} from '../controllers/cropVarietyController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCropVarieties); // all roles — for dropdowns
router.get('/all', restrictTo('admin'), getAllCropVarieties); // admin only
router.post('/', restrictTo('admin'), createCropVariety);
router.patch('/:id', restrictTo('admin'), updateCropVariety);
router.delete('/:id', restrictTo('admin'), deleteCropVariety);

export default router;
