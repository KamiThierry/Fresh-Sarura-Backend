import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    createExportBatch, getExportBatches, markReadyForExport,
    createShipment, getShipments, getShipmentById, shipShipment,
    departShipment, cancelShipment,
    uploadDocument, getDocuments, deleteDocument,
    getLogisticsActivity,
} from '../controllers/exportController.js';

const router = express.Router();
router.use(protect);

// Export Batches
router.post('/export-batches', restrictTo('production_manager', 'admin'), createExportBatch);
router.get('/export-batches', restrictTo('production_manager', 'logistic_officer', 'admin'), getExportBatches);
router.patch('/export-batches/:id/ready', restrictTo('production_manager', 'admin'), markReadyForExport);

// Shipments
router.post('/shipments', restrictTo('logistic_officer', 'admin'), createShipment);
router.get('/shipments', restrictTo('logistic_officer', 'production_manager', 'admin'), getShipments);
router.get('/shipments/:id', restrictTo('logistic_officer', 'production_manager', 'admin'), getShipmentById);
router.patch('/shipments/:id/ship', restrictTo('logistic_officer', 'admin'), shipShipment);
router.patch('/shipments/:id/depart',  restrictTo('logistic_officer', 'admin'), departShipment);
router.patch('/shipments/:id/cancel',  restrictTo('logistic_officer', 'admin'), cancelShipment);

// Export Documents
router.post('/export-documents', restrictTo('logistic_officer', 'admin'), uploadDocument);
router.get('/export-documents', restrictTo('logistic_officer', 'production_manager', 'admin'), getDocuments);
router.delete('/export-documents/:id', restrictTo('logistic_officer', 'admin'), deleteDocument);

// Logistics Activity
router.get('/logistics-activity', restrictTo('logistic_officer', 'admin'), getLogisticsActivity);

export default router;
