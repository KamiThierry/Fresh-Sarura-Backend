import express from 'express';
const router = express.Router();
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
  getVehicles, createVehicle, updateVehicle, deleteVehicle,
  getDrivers, createDriver, updateDriver, deleteDriver, assignVehicle,
  logMaintenance, getServiceLogs, closeServiceLog
} from '../controllers/fleetController.js';

// Logistics-related fleet operations
router.get('/vehicles', protect, getVehicles);
router.post('/vehicles', protect, restrictTo('admin', 'logistic_officer'), createVehicle);
router.patch('/vehicles/:id', protect, restrictTo('admin', 'logistic_officer'), updateVehicle);
router.delete('/vehicles/:id', protect, restrictTo('admin', 'logistic_officer'), deleteVehicle);

router.get('/drivers', protect, getDrivers);
router.post('/drivers', protect, restrictTo('admin', 'logistic_officer'), createDriver);
router.patch('/drivers/:id', protect, restrictTo('admin', 'logistic_officer'), updateDriver);
router.patch('/drivers/:id/assign-vehicle', protect, restrictTo('admin', 'logistic_officer'), assignVehicle);
router.delete('/drivers/:id', protect, restrictTo('admin', 'logistic_officer'), deleteDriver);

// Service Logs
router.post('/vehicles/:id/service-logs', protect, logMaintenance);
router.get('/vehicles/:id/service-logs',  protect, getServiceLogs);
router.patch('/service-logs/:logId/close', protect, closeServiceLog);

export default router;
