// This file demonstrates how to structure your backend development
// Follow this pattern for consistency across the project

/**
 * ============================================
 * CONTROLLER PATTERN
 * ============================================
 * 
 * Import dependencies:
 * import { asyncHandler } from '../utils/helpers.js';
 * import logger from '../utils/logger.js';
 * 
 * Use asyncHandler to wrap async functions:
 * export const getResource = asyncHandler(async (req, res) => {
 *   const data = await Model.findById(req.params.id);
 *   res.status(200).json({ success: true, data });
 * });
 */

/**
 * ============================================
 * ROUTE PATTERN
 * ============================================
 * 
 * import express from 'express';
 * import * as controller from '../controllers/resourceController.js';
 * 
 * const router = express.Router();
 * 
 * router.get('/', controller.getAll);
 * router.post('/', controller.create);
 * router.get('/:id', controller.getById);
 * router.put('/:id', controller.update);
 * router.delete('/:id', controller.delete);
 * 
 * export default router;
 */

/**
 * ============================================
 * MONGOOSE SCHEMA PATTERN
 * ============================================
 * 
 * import mongoose from 'mongoose';
 * 
 * const resourceSchema = new mongoose.Schema({
 *   name: { type: String, required: true, trim: true },
 *   description: { type: String, trim: true },
 *   isActive: { type: Boolean, default: true },
 * }, { timestamps: true, versionKey: false });
 * 
 * resourceSchema.index({ name: 1 });
 * 
 * export default mongoose.model('Resource', resourceSchema);
 */

/**
 * ============================================
 * ERROR HANDLING PATTERN
 * ============================================
 * 
 * import { AppError } from '../middleware/errorHandler.js';
 * 
 * // Throw custom errors:
 * if (!resource) {
 *   throw new AppError('Resource not found', 404);
 * }
 * 
 * // Errors thrown will be caught by asyncHandler
 * // and passed to the global error handler
 */

/**
 * ============================================
 * LOGGING PATTERN
 * ============================================
 * 
 * import logger from '../utils/logger.js';
 * 
 * logger.info('Information message');
 * logger.warn('Warning message');
 * logger.error('Error message');
 * logger.debug('Debug message');
 */

console.log('Development patterns guide loaded');
