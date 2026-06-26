import Farmer from '../models/Farmer.js';
import CropCycle from '../models/CropCycle.js';
import BudgetRequest from '../models/BudgetRequest.js';
import YieldForecast from '../models/YieldForecast.js';
import FieldReport from '../models/FieldReport.js';
import HarvestDeclaration from '../models/HarvestDeclaration.js';
import User from '../models/User.js';
import { createNotification } from './notificationController.js';
 
// ── Helper: Notify all Production Managers ──────────────────────────
const notifyAllPMs = async ({ senderId, senderName, type, title, message, link }) => {
    try {
        const pms = await User.find({ role: 'production_manager', isActive: true });
        const notifications = pms.map(pm => createNotification({
            recipient: pm._id,
            sender: senderId,
            type,
            title,
            message: `${senderName}: ${message}`,
            link
        }));
        await Promise.all(notifications);
    } catch (err) {
        console.error('Failed to notify PMs:', err);
    }
};
 
// ── Helper: find the Farmer doc linked to the logged-in user ──────────
const getMyFarmer = async (userId) => {
    const farmer = await Farmer.findOne({ userId });
    if (!farmer) throw new Error('NO_FARMER_PROFILE');
    return farmer;
};
 
// GET /api/v1/farm-manager/profile
export const getMyProfile = async (req, res) => {
    try {
        const farmer = await getMyFarmer(req.user._id);
        res.status(200).json({ status: 'success', data: farmer });
    } catch (err) {
        if (err.message === 'NO_FARMER_PROFILE') {
            return res.status(404).json({ status: 'error', message: 'No farmer profile linked to this account.' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// GET /api/v1/farm-manager/dashboard
export const getDashboard = async (req, res) => {
    try {
        const farmer = await getMyFarmer(req.user._id);
        const cycles = await CropCycle.find({ farmer_id: farmer._id }).sort({ createdAt: -1 });
 
        const [pendingRequests, pendingForecasts] = await Promise.all([
            BudgetRequest.countDocuments({ submittedBy: req.user._id, approvalStatus: 'Pending' }),
            YieldForecast.countDocuments({ submittedBy: req.user._id, status: 'Pending' }),
        ]);
 
        res.status(200).json({
            status: 'success',
            data: {
                farmer,
                cycles,
                summary: {
                    activeCycles: cycles.filter(c => c.status === 'Active').length,
                    pendingRequests,
                    pendingForecasts,
                    totalCycles: cycles.length,
                }
            }
        });
    } catch (err) {
        if (err.message === 'NO_FARMER_PROFILE') {
            return res.status(404).json({ status: 'error', message: 'No farmer profile linked to this account.' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// GET /api/v1/farm-manager/cycles
export const getMyCycles = async (req, res) => {
    try {
        const farmer = await getMyFarmer(req.user._id);
        const cycles = await CropCycle.find({ farmer_id: farmer._id }).sort({ createdAt: -1 });
 
        const cyclesWithRequests = await Promise.all(
            cycles.map(async (cycle) => {
                const requests = await BudgetRequest.find({
                    cycleId: cycle._id,
                    submittedBy: req.user._id,
                }).sort({ createdAt: -1 });
 
                const fieldReports = await FieldReport.find({
                    cycleId: cycle._id,
                    submittedBy: req.user._id,
                }).sort({ createdAt: -1 });

                const harvests = await HarvestDeclaration.find({
                    cycleId: cycle._id,
                    declaredBy: req.user._id,
                }).sort({ createdAt: -1 });
 
                return { ...cycle.toObject(), myRequests: requests, myFieldReports: fieldReports, myHarvests: harvests };
            })
        );
 
        res.status(200).json({ status: 'success', results: cyclesWithRequests.length, data: cyclesWithRequests });
    } catch (err) {
        if (err.message === 'NO_FARMER_PROFILE') {
            return res.status(404).json({ status: 'error', message: 'No farmer profile linked to this account.' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// POST /api/v1/farm-manager/budget-requests
export const submitBudgetRequest = async (req, res) => {
    try {
        const { cycleId, cycleName, startDate, endDate, lineItems } = req.body;
 
        if (!cycleId || !startDate || !endDate || !lineItems?.length) {
            return res.status(400).json({ status: 'error', message: 'cycleId, startDate, endDate, and lineItems are required.' });
        }
 
        // ── V1: Block requests on completed/cancelled cycles ──────────────
        const cycle = await CropCycle.findById(cycleId);
        if (!cycle) {
            return res.status(404).json({ status: 'error', message: 'Crop cycle not found.' });
        }
        if (cycle.status === 'completed' || cycle.status === 'cancelled') {
            return res.status(400).json({
                status: 'error',
                code: 'CYCLE_CLOSED',
                message: `Cannot submit a budget request for a ${cycle.status} crop cycle.`,
            });
        }
 
        // ── V5: Block duplicate pending activities ────────────────────────
        const existingPending = await BudgetRequest.find({
            cycleId,
            submittedBy: req.user._id,
            approvalStatus: 'Pending',
        });
 
        if (existingPending.length > 0) {
            const existingActivityNames = existingPending.flatMap(r =>
                r.lineItems.map(item => item.activityName.trim().toLowerCase())
            );
            const newActivityNames = lineItems.map(item => item.activityName.trim().toLowerCase());
            const duplicates = newActivityNames.filter(name => existingActivityNames.includes(name));
 
            if (duplicates.length > 0) {
                return res.status(409).json({
                    status: 'error',
                    code: 'DUPLICATE_ACTIVITY',
                    message: `The following activities already have a pending request awaiting PM approval: "${duplicates.join('", "')}"`,
                    duplicates,
                });
            }
        }
 
        // ── V6: Category-Specific Budget Block ────────────────────────────
        // Check if each activity request fits within its category's remaining budget
        const existingRequests = await BudgetRequest.find({
            cycleId,
            approvalStatus: { $in: ['Approved', 'Pending'] }
        });

        // Map existing category usage
        const categoryUsage = {};
        existingRequests.forEach(r => {
            r.lineItems.forEach(item => {
                const cat = item.category;
                categoryUsage[cat] = (categoryUsage[cat] || 0) + (item.estimatedCostRwf || 0);
            });
        });

        // Validate each new line item
        const errors = [];
        lineItems.forEach(newItem => {
            const cat = newItem.category;
            const requested = newItem.estimatedCostRwf || 0;
            const alreadyUsed = categoryUsage[cat] || 0;
            
            const categoryConfig = cycle.budget_categories.find(c => c.name === cat);
            const limit = categoryConfig ? categoryConfig.allocated : 0;

            if (alreadyUsed + requested > limit) {
                errors.push({
                    category: cat,
                    requested,
                    limit,
                    available: Math.max(0, limit - alreadyUsed)
                });
            }
        });

        if (errors.length > 0) {
            const errorMsg = errors.map(e => 
                `${e.category}: requested ${e.requested.toLocaleString()} Rwf, but only ${e.available.toLocaleString()} Rwf remaining (Limit: ${e.limit.toLocaleString()} Rwf)`
            ).join('; ');

            return res.status(400).json({
                status: 'error',
                code: 'CATEGORY_BUDGET_EXCEEDED',
                message: `Category Budget Limit Exceeded: ${errorMsg}`,
                errors
            });
        }
        // ─────────────────────────────────────────────────────────────────
  
        const totalRequestedRwf = lineItems.reduce((sum, item) => sum + (item.estimatedCostRwf || 0), 0);
 
        const request = await BudgetRequest.create({
            cycleId,
            cycleName,
            submittedBy: req.user._id,
            submittedByName: req.user.name,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            lineItems,
            totalRequestedRwf,
            approvalStatus: 'Pending',
        });
 
        res.status(201).json({
            status: 'success',
            message: 'Budget request submitted. Awaiting PM approval.',
            data: request,
        });
 
        notifyAllPMs({
            senderId: req.user._id,
            senderName: req.user.name,
            type: 'BUDGET_REQUEST',
            title: 'New Budget Request',
            message: `New budget request submitted for ${cycleName || 'Crop Cycle'}.`,
            link: '/pm/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// GET /api/v1/farm-manager/budget-requests
export const getMyBudgetRequests = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({ submittedBy: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: requests.length, data: requests });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// POST /api/v1/farm-manager/field-reports
export const submitFieldReport = async (req, res) => {
    console.log('--- BACKEND: submitFieldReport START ---');
    console.log('User:', req.user?.email, 'Role:', req.user?.role);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    try {
        const {
            cycleId, budgetRequestId, description,
            category, block, approvedAmountRwf,
            actualCostRwf, notes, hasProof, proofUrl
        } = req.body;
 
        if (!cycleId || !description || actualCostRwf === undefined) {
            return res.status(400).json({ status: 'error', message: 'cycleId, description, and actualCostRwf are required.' });
        }
 
        // ── V1 (also for field reports): Block on completed cycles ────────
        const cycle = await CropCycle.findById(cycleId);
        if (!cycle) {
            return res.status(404).json({ status: 'error', message: 'Crop cycle not found.' });
        }
        if (cycle.status === 'completed' || cycle.status === 'cancelled') {
            return res.status(400).json({
                status: 'error',
                code: 'CYCLE_CLOSED',
                message: `Cannot submit a field report for a ${cycle.status} crop cycle.`,
            });
        }
 
        // ── V2: Require linked budget request to be Approved ─────────────
        if (budgetRequestId) {
            const budgetRequest = await BudgetRequest.findById(budgetRequestId);
            if (!budgetRequest) {
                return res.status(404).json({ status: 'error', message: 'Linked budget request not found.' });
            }
            if (budgetRequest.approvalStatus !== 'Approved') {
                return res.status(400).json({
                    status: 'error',
                    code: 'REQUEST_NOT_APPROVED',
                    message: `Cannot log a field report against a budget request that is "${budgetRequest.approvalStatus}". The request must be approved by the PM first.`,
                });
            }
        }
 
        // ── V6.2: Hard Budget Block ──────────────────────────────────────
        // Prevent FM from reporting more than what was approved for this task
        if (approvedAmountRwf > 0 && actualCostRwf > approvedAmountRwf) {
            return res.status(400).json({
                status: 'error',
                code: 'BUDGET_LIMIT_EXCEEDED',
                message: `Actual cost (${actualCostRwf.toLocaleString()} Rwf) cannot exceed the approved budget for this task (${approvedAmountRwf.toLocaleString()} Rwf).`,
                approvedAmountRwf,
                actualCostRwf
            });
        }

        const report = await FieldReport.create({
            cycleId,
            budgetRequestId: budgetRequestId || null,
            submittedBy: req.user._id,
            submittedByName: req.user.name,
            description,
            category,
            block,
            approvedAmountRwf: approvedAmountRwf || 0,
            actualCostRwf,
            notes,
            hasProof: hasProof || !!proofUrl,
            proofUrl: proofUrl || null,
            status: 'Submitted',
        });
 
        // Update the cycle's spent total and the specific category spent
        await CropCycle.findOneAndUpdate(
            { _id: cycleId, "budget_categories.name": category },
            {
                $inc: {
                    spent: actualCostRwf,
                    "budget_categories.$.spent": actualCostRwf
                }
            }
        );
 
        res.status(201).json({
            status: 'success',
            message: 'Field report submitted successfully.',
            data: report,
        });
 
        notifyAllPMs({
            senderId: req.user._id,
            senderName: req.user.name,
            type: 'BUDGET_REQUEST',
            title: 'New Field Report',
            message: `A new field report was submitted for cycle ${cycleId}.`,
            link: '/pm/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// GET /api/v1/farm-manager/field-reports
export const getMyFieldReports = async (req, res) => {
    try {
        const reports = await FieldReport.find({ submittedBy: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: reports.length, data: reports });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// POST /api/v1/farm-manager/yield-forecasts
export const submitYieldForecast = async (req, res) => {
    try {
        const { cycleId, harvestDate, predictionKg, confidence, notes } = req.body;
 
        if (!cycleId || !harvestDate || !predictionKg) {
            return res.status(400).json({ status: 'error', message: 'cycleId, harvestDate, and predictionKg are required.' });
        }

        const cycle = await CropCycle.findById(cycleId);
        if (!cycle) {
            return res.status(404).json({ status: 'error', message: 'Crop cycle not found.' });
        }

        // ── V7: Date Validation ──────────────────────────────────────────
        const harvestDateObj = new Date(harvestDate);
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);

        if (harvestDateObj < todayAtMidnight) {
            return res.status(400).json({ status: 'error', message: 'Harvest date cannot be in the past.' });
        }
        if (harvestDateObj < new Date(cycle.start_date)) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Harvest date cannot be earlier than the cycle start date (${new Date(cycle.start_date).toLocaleDateString()}).` 
            });
        }
        // ─────────────────────────────────────────────────────────────────

        // ── V8: Duplicate Prevention ─────────────────────────────────────
        const existingPending = await YieldForecast.findOne({
            cycleId,
            submittedBy: req.user._id,
            status: 'Pending'
        });

        if (existingPending) {
            return res.status(409).json({
                status: 'error',
                message: 'You already have a pending forecast for this cycle. Please wait for PM verification before submitting a new one.'
            });
        }
        // ─────────────────────────────────────────────────────────────────
 
        const forecast = await YieldForecast.create({
            cycleId,
            submittedBy: req.user._id,
            submittedByName: req.user.name,
            harvestDate: new Date(harvestDate),
            predictionKg,
            confidence: confidence || 'Medium',
            notes,
            status: 'Pending',
        });
 
        await CropCycle.findByIdAndUpdate(cycleId, {
            yield_goal: `${Number(predictionKg).toLocaleString()} kg`
        });
 
        res.status(201).json({
            status: 'success',
            message: 'Yield forecast submitted. Awaiting PM verification.',
            data: forecast,
        });
 
        notifyAllPMs({
            senderId: req.user._id,
            senderName: req.user.name,
            type: 'BUDGET_REQUEST',
            title: 'New Yield Forecast',
            message: `A new yield forecast has been submitted for cycle ${cycleId}.`,
            link: '/pm/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
 
// GET /api/v1/farm-manager/yield-forecasts
export const getMyYieldForecasts = async (req, res) => {
    try {
        const forecasts = await YieldForecast.find({ submittedBy: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: forecasts.length, data: forecasts });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/farm-manager/activity
export const getMyActivity = async (req, res) => {
    try {
        const farmer = await getMyFarmer(req.user._id);
        const limit = parseInt(req.query.limit) || 10;

        // 1. Crop Cycles Assigned
        const cycles = await CropCycle.find({ farmer_id: farmer._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const formattedCycles = cycles.map(c => ({
            id: c._id,
            type: 'cycle',
            time: c.createdAt,
            event: `New crop cycle assigned: ${c.crop_name}`,
            status: c.status.charAt(0).toUpperCase() + c.status.slice(1)
        }));

        // 2. Budget Requests
        const budgets = await BudgetRequest.find({ submittedBy: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const formattedBudgets = budgets.map(b => ({
            id: b._id,
            type: 'budget',
            time: b.createdAt,
            event: `Budget request submitted for ${b.cycleName}`,
            status: b.approvalStatus
        }));

        // 3. Flagged Reports
        const reports = await FieldReport.find({ submittedBy: req.user._id, status: 'Flagged' })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();
        const formattedReports = reports.map(r => ({
            id: r._id,
            type: 'report',
            time: r.updatedAt,
            event: `Field report flagged by PM: ${r.description}`,
            status: 'Flagged'
        }));

        // 4. Yield Forecasts
        const forecasts = await YieldForecast.find({ submittedBy: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const formattedForecasts = forecasts.map(f => ({
            id: f._id,
            type: 'forecast',
            time: f.createdAt,
            event: `Yield forecast submitted: ${f.predictionKg} kg`,
            status: f.status
        }));

        const combined = [
            ...formattedCycles,
            ...formattedBudgets,
            ...formattedReports,
            ...formattedForecasts
        ];

        combined.sort((a, b) => new Date(b.time) - new Date(a.time));
        const topRecent = combined.slice(0, limit);

        res.status(200).json({ status: 'success', data: topRecent });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};