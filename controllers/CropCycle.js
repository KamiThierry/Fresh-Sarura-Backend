import CropCycle from '../models/CropCycle.js';
import Farmer from '../models/Farmer.js';
import BudgetRequest from '../models/BudgetRequest.js';
import YieldForecast from '../models/YieldForecast.js';
import FieldReport from '../models/FieldReport.js';
import HarvestDeclaration from '../models/HarvestDeclaration.js';
import { createNotification } from './notificationController.js';
import { createEventLog } from './eventLogController.js';

// GET /api/v1/crop-cycles  (supports ?farmer_id=<id> filter)
export const getCropCycles = async (req, res) => {
    try {
        const filter = {};
        if (req.query.farmer_id) filter.farmer_id = req.query.farmer_id;
        
        const { startDate, endDate } = req.query;
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }
        const cycles = await CropCycle.find(filter)
            .populate('farmer_id')
            .sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: cycles.length, data: cycles });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// POST /api/v1/crop-cycles
export const createCropCycle = async (req, res) => {
    try {
        console.log("POST /api/v1/crop-cycles payload:", req.body);
        const {
            farmer_id,
            farm_name,
            crop_name,
            season,
            planting_date,
            expected_harvest_date,
            block_name,
            block_size_hectares,
            field_size_hectares,
            total_budget,
            budget_seeds,
            budget_fertilizers,
            budget_chemicals,
            budget_labor,
            yield_goal_kg,
            expected_price_per_kg,
        } = req.body;

        // Duplicate check: Same farmer, crop, and season must not have an active cycle
        const existing = await CropCycle.findOne({
            farmer_id,
            crop_name,
            season,
            status: { $nin: ['completed', 'cancelled'] },
        });

        if (existing) {
            return res.status(409).json({
                status: 'error',
                message: `An active cycle for ${crop_name} already exists for this farmer in ${season}. Close or complete it before creating a new one.`
            });
        }

        // Validate required fields
        if (!farmer_id || !crop_name || !season || !planting_date || !expected_harvest_date || !block_name || 
            block_size_hectares === undefined || field_size_hectares === undefined || 
            total_budget === undefined || expected_price_per_kg === undefined) {
            console.log("Validation failed on backend. Missing fields.");
            return res.status(400).json({
                status: 'error',
                message: 'farmer_id, crop_name, season, planting_date, expected_harvest_date, block_name, block_size_hectares, field_size_hectares, expected_price_per_kg, and total_budget are required.',
            });
        }

        const cycle = await CropCycle.create({
            farmer_id,
            farm_name: farm_name || '',
            crop_name,
            season,
            planting_date: new Date(planting_date),
            expected_harvest_date: new Date(expected_harvest_date),
            block_name: block_name || '',
            block_size_hectares: parseFloat(block_size_hectares) || 0,
            field_size_hectares: parseFloat(field_size_hectares) || 0,
            total_budget: parseFloat(total_budget) || 0,
            budget_seeds: parseFloat(budget_seeds) || 0,
            budget_fertilizers: parseFloat(budget_fertilizers) || 0,
            budget_chemicals: parseFloat(budget_chemicals) || 0,
            budget_labor: parseFloat(budget_labor) || 0,
            yield_goal_kg: yield_goal_kg ? parseFloat(yield_goal_kg) : 0,
            expected_price_per_kg: parseFloat(expected_price_per_kg) || 0,
            registeredBy: req.user._id,
        });

        // Trigger Notification for the Farm Manager
        try {
            const farmer = await Farmer.findById(farmer_id);
            if (farmer && farmer.userId) {
                await createNotification({
                    recipient: farmer.userId,
                    sender: req.user._id,
                    type: 'NEW_CYCLE',
                    title: 'New Crop Cycle Assigned',
                    message: `You have been assigned a new ${crop_name} cycle for ${season}.`,
                    link: '/farm-manager/crop-planning'
                });
            }
        } catch (notifyErr) {
            console.error('Failed to send assignment notification:', notifyErr);
        }

        res.status(201).json({ status: 'success', message: 'Crop cycle created!', data: cycle });

        await createEventLog({
            module: 'Crop Planning',
            action: 'Crop Cycle Created',
            severity: 'INFO',
            description: `New crop cycle created: ${crop_name} for ${farm_name} (${season})`,
            actor: req.user.name,
            metadata: { cycleId: cycle.cycleId, cropName: crop_name, farmName: farm_name, season }
        });
    } catch (err) {
        console.error("Error creating crop cycle:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/:id
export const updateCropCycle = async (req, res) => {
    try {
        const cycle = await CropCycle.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Crop cycle not found.' });
        res.status(200).json({ status: 'success', data: cycle });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/v1/crop-cycles/:id
export const deleteCropCycle = async (req, res) => {
    try {
        const cycle = await CropCycle.findById(req.params.id);
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Cycle not found.' });

        if (cycle.status === 'completed') {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Cannot delete a completed cycle.' 
            });
        }

        // ── Cascading Delete: remove all associated sub-documents ────────
        await Promise.all([
            CropCycle.findByIdAndDelete(req.params.id),
            BudgetRequest.deleteMany({ cycleId: req.params.id }),
            FieldReport.deleteMany({ cycleId: req.params.id }),
            YieldForecast.deleteMany({ cycleId: req.params.id }),
            HarvestDeclaration.deleteMany({ cycleId: req.params.id })
        ]);

        await createEventLog({
            module: 'Crop Planning',
            action: 'Crop Cycle Deleted',
            severity: 'WARNING',
            description: `Crop cycle deleted: ${cycle.crop_name} (${cycle.cycleId})`,
            actor: req.user.name,
            metadata: { cycleId: cycle.cycleId, crop: cycle.crop_name, farm: cycle.farm_name }
        });

        res.status(200).json({ status: 'success', message: 'Cycle deleted successfully.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/crop-cycles/:id/full  — returns cycle + all related sub-documents
export const getCropCycleFull = async (req, res) => {
    try {
        const cycle = await CropCycle.findById(req.params.id)
            .populate('farmer_id')
            .populate('registeredBy');
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Cycle not found.' });

        const [budgetRequests, forecasts, fieldReports] = await Promise.all([
            BudgetRequest.find({ cycleId: req.params.id }).sort({ createdAt: -1 }),
            YieldForecast.find({ cycleId: req.params.id }).sort({ createdAt: -1 }),
            FieldReport.find({ cycleId: req.params.id }).sort({ createdAt: -1 }),
        ]);

        res.status(200).json({
            status: 'success',
            data: { cycle, budgetRequests, forecasts, fieldReports },
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/:id/close
export const closeCropCycle = async (req, res) => {
    try {
        const { finalYield } = req.body;
        const cycle = await CropCycle.findByIdAndUpdate(
            req.params.id,
            { status: 'completed', final_yield: finalYield },
            { new: true }
        );
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Cycle not found.' });
        res.status(200).json({ status: 'success', message: 'Cycle closed.', data: cycle });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/crop-cycles/budget-requests/pending
export const getPendingBudgetRequests = async (req, res) => {
    try {
        const requests = await BudgetRequest.find({ approvalStatus: 'Pending' }).sort({ createdAt: -1 });

        const populatedRequests = await Promise.all(requests.map(async (r) => {
            const reqObj = r.toObject();
            const cycle = await CropCycle.findById(r.cycleId);
            
            reqObj.farm_name = cycle?.farm_name || cycle?.block_name || 'Farm';
            reqObj.cycle_budget_categories = cycle?.budget_categories || [];
            reqObj.cycle_total_budget = cycle?.total_budget || 0;
            reqObj.cycle_spent = cycle?.spent || 0;
            
            return reqObj;
        }));

        res.status(200).json({ status: 'success', data: populatedRequests });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/budget-requests/:id/approve   — V3 + V4
export const approveBudgetRequest = async (req, res) => {
    try {
        const request = await BudgetRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ status: 'error', message: 'Request not found.' });

        // ── V4: Block approval on completed/cancelled cycles ──────────────
        const cycle = await CropCycle.findById(request.cycleId);
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Linked crop cycle not found.' });

        if (cycle.status === 'completed' || cycle.status === 'cancelled') {
            return res.status(400).json({
                status: 'error',
                code: 'CYCLE_CLOSED',
                message: `Cannot approve a budget request for a ${cycle.status} crop cycle.`,
            });
        }

        // ── V3: Check category budget ceiling ─────────────────────────────
        // Build a map of how much each category would exceed if approved
        const overdraftDetails = [];

        if (cycle.budget_categories?.length > 0) {
            // Group request line items by category
            const requestedByCategory = {};
            for (const item of request.lineItems) {
                const cat = item.category || 'General';
                requestedByCategory[cat] = (requestedByCategory[cat] || 0) + (item.estimatedCostRwf || 0);
            }

            for (const [catName, requestedAmount] of Object.entries(requestedByCategory)) {
                const budgetCat = cycle.budget_categories.find(c => c.name === catName);
                console.log(`[Validation] Checking category: ${catName}`, {
                    found: !!budgetCat,
                    allocated: budgetCat?.allocated,
                    approved: budgetCat?.approved,
                    requested: requestedAmount
                });
                
                if (budgetCat) {
                    const remainingBudget = (budgetCat.allocated || 0) - (budgetCat.approved || 0);
                    if (requestedAmount > remainingBudget) {
                        console.warn(`[Validation] OVERDRAFT detected for ${catName}: requested ${requestedAmount} > remaining ${remainingBudget}`);
                        overdraftDetails.push({
                            category: catName,
                            requested: requestedAmount,
                            remaining: remainingBudget,
                            excess: requestedAmount - remainingBudget,
                        });
                    }
                }
            }
        }

        // If overdraft detected AND PM hasn't confirmed they want to proceed, block it
        // The frontend sends { pmNote, forceApprove: true } when PM confirms override
        if (overdraftDetails.length > 0 && !req.body.forceApprove) {
            return res.status(400).json({
                status: 'error',
                code: 'BUDGET_OVERDRAFT',
                message: 'Approving this request will exceed the allocated budget for one or more categories.',
                overdraftDetails,
            });
        }

        // All checks passed — approve and update category budgets
        const updatedRequest = await BudgetRequest.findByIdAndUpdate(
            req.params.id,
            { approvalStatus: 'Approved', pmNote: req.body.pmNote || '' },
            { new: true }
        );

        if (cycle.budget_categories) {
            let totalAdded = 0;
            const updatedCategories = cycle.budget_categories.map(cat => {
                const matchingItems = request.lineItems.filter(item => item.category === cat.name);
                const sumForCat = matchingItems.reduce((acc, item) => acc + (item.estimatedCostRwf || 0), 0);
                totalAdded += sumForCat;
                return { ...cat.toObject(), approved: (cat.approved || 0) + sumForCat };
            });

            cycle.budget_categories = updatedCategories;
            cycle.approved = (cycle.approved || 0) + totalAdded;
            
        }
        
        // Trigger transition to 'in_progress' on first budget approval
        if (cycle.status === 'active') {
            cycle.status = 'in_progress';
        }
        
        await cycle.save();

        res.status(200).json({ status: 'success', data: updatedRequest });

        createNotification({
            recipient: request.submittedBy,
            sender: req.user._id,
            type: 'BUDGET_APPROVED',
            title: 'Budget Request Approved',
            message: `Your budget request for ${request.cycleName || 'Crop Cycle'} has been approved.`,
            link: '/farm-manager/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/budget-requests/:id/reject   — V4
export const rejectBudgetRequest = async (req, res) => {
    try {
        const request = await BudgetRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ status: 'error', message: 'Request not found.' });

        // ── V4: Block rejection on completed/cancelled cycles ─────────────
        const cycle = await CropCycle.findById(request.cycleId);
        if (cycle && (cycle.status === 'completed' || cycle.status === 'cancelled')) {
            return res.status(400).json({
                status: 'error',
                code: 'CYCLE_CLOSED',
                message: `Cannot reject a budget request for a ${cycle.status} crop cycle.`,
            });
        }

        const updatedRequest = await BudgetRequest.findByIdAndUpdate(
            req.params.id,
            { approvalStatus: 'Rejected', pmNote: req.body.pmNote || '' },
            { new: true }
        );

        res.status(200).json({ status: 'success', data: updatedRequest });

        createNotification({
            recipient: request.submittedBy,
            sender: req.user._id,
            type: 'BUDGET_REJECTED',
            title: 'Budget Request Rejected',
            message: `Your budget request for ${request.cycleName || 'Crop Cycle'} was rejected. Reason: ${req.body.pmNote || 'None provided'}`,
            link: '/farm-manager/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/yield-forecasts/:id/verify
export const verifyForecast = async (req, res) => {
    try {
        const forecast = await YieldForecast.findByIdAndUpdate(
            req.params.id,
            { status: 'Verified', pmReply: req.body.pmReply || '' },
            { new: true }
        );
        if (!forecast) return res.status(404).json({ status: 'error', message: 'Forecast not found.' });

        // Status is managed by budget approval only — no change on forecast submission

        res.status(200).json({ status: 'success', data: forecast });

        // Trigger Notification
        createNotification({
            recipient: forecast.submittedBy,
            sender: req.user._id,
            type: 'FORECAST_VERIFIED',
            title: 'Forecast Verified',
            message: `Your yield forecast for cycle ${forecast.cycleId} has been verified by the PM.`,
            link: '/farm-manager/yield-forecast'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};


// PATCH /api/v1/field-reports/:id/flag
export const flagFieldReport = async (req, res) => {
    try {
        const report = await FieldReport.findByIdAndUpdate(
            req.params.id,
            { status: 'Flagged', pmFlag: req.body.reason },
            { new: true }
        );
        if (!report) return res.status(404).json({ status: 'error', message: 'Report not found.' });
        res.status(200).json({ status: 'success', data: report });

        // Trigger Notification
        createNotification({
            recipient: report.submittedBy,
            sender: req.user._id,
            type: 'REPORT_FLAGGED',
            title: 'Field Report Flagged',
            message: `Your field report for cycle ${report.cycleId} was flagged. Reason: ${req.body.reason}`,
            link: '/farm-manager/crop-planning'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/crop-cycles/forecasts/pending
export const getPendingForecasts = async (req, res) => {
    try {
        const forecasts = await YieldForecast.find({ status: 'Pending' }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', data: forecasts });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/crop-cycles/field-reports/pending (getters)
export const getPendingFieldReports = async (req, res) => {
    try {
        const reports = await FieldReport.find({ status: 'Submitted' }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', data: reports });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/budget-requests/:id/read
export const markRequestAsRead = async (req, res) => {
    try {
        await BudgetRequest.findByIdAndUpdate(req.params.id, { isReadByPM: true });
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/yield-forecasts/:id/read
export const markForecastAsRead = async (req, res) => {
    try {
        await YieldForecast.findByIdAndUpdate(req.params.id, { isReadByPM: true });
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/field-reports/:id/read
export const markReportAsRead = async (req, res) => {
    try {
        await FieldReport.findByIdAndUpdate(req.params.id, { isReadByPM: true });
        res.status(200).json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/crop-cycles/:id/adjust-budget
export const adjustBudget = async (req, res) => {
    try {
        const { categoryName, newAllocated } = req.body;
        const cycle = await CropCycle.findById(req.params.id);
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Cycle not found.' });

        const existing = cycle.budget_categories || [];
        console.log(`[Adjust] Adjusting ${categoryName} to ${newAllocated} for cycle ${cycle.cycleId}`);
        
        const updated = existing.map(cat =>
            cat.name === categoryName ? { ...cat.toObject(), allocated: Number(newAllocated) } : cat
        );
        cycle.budget_categories = updated;
        
        // Recalculate total_budget to keep it in sync
        cycle.total_budget = cycle.budget_categories.reduce((sum, cat) => sum + (cat.allocated || 0), 0);
        console.log(`[Adjust] New Total Budget: ${cycle.total_budget}`);
        
        await cycle.save();
        res.status(200).json({ status: 'success', data: cycle });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
}