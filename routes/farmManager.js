import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import {
    getMyProfile,
    getDashboard,
    getMyCycles,
    submitBudgetRequest,
    getMyBudgetRequests,
    submitFieldReport,
    getMyFieldReports,
    submitYieldForecast,
    getMyYieldForecasts,
    getMyActivity,
} from '../controllers/farmManagerController.js';

const router = express.Router();

// All routes require a valid JWT + farm_manager role
router.use(protect);
router.use(restrictTo('farm_manager', 'admin'));

router.get('/profile', getMyProfile);
router.get('/dashboard', getDashboard);
router.get('/activity', getMyActivity);

router.get('/cycles', getMyCycles);

router.route('/budget-requests')
    .get(getMyBudgetRequests)
    .post(submitBudgetRequest);

router.route('/field-reports')
    .get(getMyFieldReports)
    .post(submitFieldReport);

router.route('/yield-forecasts')
    .get(getMyYieldForecasts)
    .post(submitYieldForecast);

export default router;