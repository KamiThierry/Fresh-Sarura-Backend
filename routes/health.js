import express from 'express';
import * as healthController from '../controllers/healthController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    Get basic health status
 * @access  Public
 */
router.get('/', healthController.getHealth);

/**
 * @route   GET /api/v1/health/detailed
 * @desc    Get detailed health information
 * @access  Public
 */
router.get('/detailed', healthController.getDetailedHealth);

export default router;
