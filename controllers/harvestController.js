import mongoose from 'mongoose';
import HarvestDeclaration from '../models/HarvestDeclaration.js';
import IntakeLog from '../models/IntakeLog.js';
import ProcessingBatch from '../models/ProcessingBatch.js';
import CropCycle from '../models/CropCycle.js';
import Notification from '../models/Notification.js';
import Room from '../models/Room.js';
import Driver from '../models/Driver.js';
import Vehicle from '../models/Vehicle.js';
import { notifyByRole } from './notificationController.js';
import { syncAllRoomLoads } from './roomController.js';
import { createEventLog } from './eventLogController.js';

// ── HARVEST DECLARATIONS ──────────────────────────────────────────────────────

// POST /api/v1/harvest-declarations  ← FM declares harvest
export const declareHarvest = async (req, res) => {
    try {
        const { cycleId, estimatedWeightKg, cropName, farmName, notes } = req.body;
        if (!cycleId || !estimatedWeightKg || !cropName) {
            return res.status(400).json({ status: 'error', message: 'cycleId, estimatedWeightKg, cropName required.' });
        }
        const cycle = await CropCycle.findById(cycleId);
        if (!cycle) return res.status(404).json({ status: 'error', message: 'Crop cycle not found.' });

        // Guard: prevent harvest declaration on cycles with no approved budget activity
        if (cycle.status === 'active' || (cycle.approved || 0) === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Harvest cannot be declared yet. This crop cycle has no approved budget requests. At least one budget request must be approved by the Production Manager before declaring a harvest, confirming that field work such as planting, irrigation, or pest control has been funded and carried out.'
            });
        }

        // Guard: prevent duplicate harvest declaration on a completed cycle
        if (cycle.status === 'completed') {
            return res.status(400).json({
                status: 'error',
                message: 'This crop cycle is already completed. No further harvest declarations can be submitted.'
            });
        }

        const declaration = await HarvestDeclaration.create({
            cycleId,
            farmerId: cycle.farmer_id,
            declaredBy: req.user._id,
            estimatedWeightKg,
            cropName,
            farmName: farmName || cycle.farm_name,
            notes,
        });

        // Notify all logistic_officer users
        await notifyByRole('logistic_officer', {
            type: 'HARVEST_DECLARED',
            title: 'New Harvest Declared',
            message: `Harvest declared: ${cropName} — est. ${estimatedWeightKg} kg. Ready for pickup.`,
            refId: declaration._id,
            refModel: 'HarvestDeclaration',
        });

        // Notify all quality_officer users
        await notifyByRole('quality_officer', {
            type: 'HARVEST_DECLARED',
            title: 'New Harvest Declared',
            message: `Harvest declared: ${cropName} — est. ${estimatedWeightKg} kg. Ready for pickup.`,
            refId: declaration._id,
            refModel: 'HarvestDeclaration',
        });

        // No cycle status change on harvest declaration — status is managed by budget approval flow

        res.status(201).json({ status: 'success', data: declaration });

        await createEventLog({
            module: 'Production & QC',
            action: 'Harvest Declared',
            severity: 'INFO',
            description: `Harvest declared: ${cropName} — est. ${estimatedWeightKg} kg from ${farmName}`,
            actor: req.user.name,
            metadata: { cycleId, cropName, estimatedWeightKg, farmName }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/harvest-declarations  ← LO sees pending pickups
export const getHarvestDeclarations = async (req, res) => {
    try {
        const filter = req.query.status ? { status: req.query.status } : {};
        const declarations = await HarvestDeclaration.find(filter)
            .populate('cycleId', 'crop_name farm_name')
            .populate('farmerId', 'full_name cooperative_name district')
            .populate('declaredBy', 'name')
            .sort({ createdAt: -1 });
        res.json({ status: 'success', results: declarations.length, data: declarations });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/harvest-declarations/:id/pickup  ← LO logs pickup weight
export const logPickup = async (req, res) => {
    try {
        const { pickedUpWeightKg, truckId } = req.body;
        
        // 1. Basic input validation
        if (!pickedUpWeightKg) return res.status(400).json({ status: 'error', message: 'pickedUpWeightKg required.' });
        if (pickedUpWeightKg <= 0) return res.status(400).json({ status: 'error', message: 'Actual weight must be greater than 0 kg.' });
        if (!truckId) return res.status(400).json({ status: 'error', message: 'A vehicle must be selected to log a pickup.' });

        // 2. Declaration validation
        const declaration = await HarvestDeclaration.findById(req.params.id);
        if (!declaration) return res.status(404).json({ status: 'error', message: 'Declaration not found.' });
        if (declaration.status === 'PickedUp') return res.status(400).json({ status: 'error', message: 'This harvest has already been logged as picked up.' });

        // 3. Weight discrepancy validation (Max 20% over estimate)
        const maxAllowedWeight = declaration.estimatedWeightKg * 1.2;
        if (pickedUpWeightKg > maxAllowedWeight) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Weight discrepancy too high. Collected weight (${pickedUpWeightKg} kg) exceeds the estimated weight (${declaration.estimatedWeightKg} kg) by more than 20%. Please verify with the driver.` 
            });
        }

        // 4. Vehicle & Maintenance validation
        let resolvedTruckId = truckId;
        const vehicle = await Vehicle.findById(truckId);
        if (!vehicle) {
            return res.status(404).json({ status: 'error', message: 'The selected vehicle does not exist in the database.' });
        }
        
        if (vehicle.status === 'Maintenance') {
            return res.status(400).json({ status: 'error', message: 'This vehicle is currently under maintenance and cannot be assigned to a pickup trip.' });
        }

        resolvedTruckId = vehicle.plateNumber;

        // 5. Create IntakeLog
        const intakeLog = await IntakeLog.create({
            harvestDeclarationId: declaration._id,
            cycleId: declaration.cycleId,
            pickedUpWeightKg,
            truckId: resolvedTruckId,
            loggedBy: req.user._id,
        });

        // 6. Mark declaration as picked up
        declaration.status = 'PickedUp';
        declaration.intakeLogId = intakeLog._id;
        await declaration.save();

        // 7. Notifications
        await notifyByRole('quality_officer', {
            type: 'HARVEST_PICKED_UP',
            title: 'Produce Arriving',
            message: `Produce arriving: ${declaration.cropName} — ${pickedUpWeightKg} kg picked up. Intake log ready.`,
            refId: intakeLog._id,
            refModel: 'IntakeLog',
        });

        await notifyByRole('logistic_officer', {
            type: 'HARVEST_PICKED_UP',
            title: 'Produce Arriving',
            message: `Produce arriving: ${declaration.cropName} — ${pickedUpWeightKg} kg picked up. Intake log ready.`,
            refId: intakeLog._id,
            refModel: 'IntakeLog',
        });

        res.json({ status: 'success', message: 'Pickup logged successfully.', data: intakeLog });

        await createEventLog({
            module: 'Production & QC',
            action: 'Produce Picked Up',
            severity: 'INFO',
            description: `Produce picked up: ${declaration.cropName} — ${pickedUpWeightKg} kg (Truck: ${resolvedTruckId})`,
            actor: req.user.name,
            metadata: { intakeLogId: intakeLog._id, cropName: declaration.cropName, pickedUpWeightKg, truckId: resolvedTruckId }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── PROCESSING BATCHES ────────────────────────────────────────────────────────

// POST /api/v1/processing-batches  ← QC requests a room
export const requestRoom = async (req, res) => {
    try {
        const { intakeLogId, receivedWeightKg, cropName } = req.body;
        if (!intakeLogId || !receivedWeightKg) return res.status(400).json({ status: 'error', message: 'intakeLogId, receivedWeightKg required.' });

        const intakeLog = await IntakeLog.findById(intakeLogId);
        if (!intakeLog) return res.status(404).json({ status: 'error', message: 'Intake log not found.' });

        const batch = await ProcessingBatch.create({
            intakeLogId,
            cycleId: intakeLog.cycleId,
            requestedBy: req.user._id,
            receivedWeightKg,
            cropName: cropName || '',
        });

        // Notify all production_manager users
        await notifyByRole('production_manager', {
            type: 'ROOM_REQUESTED',
            title: 'Processing Room Requested',
            message: `QC requests a processing room for ${cropName || 'produce'} — ${receivedWeightKg} kg received.`,
            refId: batch._id,
            refModel: 'ProcessingBatch',
        });

        res.status(201).json({ status: 'success', data: batch });

        await createEventLog({
            module: 'Production & QC',
            action: 'Room Requested',
            severity: 'INFO',
            description: `Processing room requested for ${cropName || 'produce'} (${receivedWeightKg} kg)`,
            actor: req.user.name,
            metadata: { batchId: batch._id, receivedWeightKg, cropName }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/processing-batches/pending-room  ← PM sees room requests
export const getMyBatches = async (req, res) => {
    try {
        const batches = await ProcessingBatch.find({ requestedBy: req.user._id })
            .populate('intakeLogId', 'pickedUpWeightKg arrivedAt truckId')
            .sort({ createdAt: -1 });
        res.json({ status: 'success', results: batches.length, data: batches });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

export const getPendingRoomRequests = async (req, res) => {
    try {
        const batches = await ProcessingBatch.find({ status: 'RoomRequested' })
            .populate('intakeLogId', 'pickedUpWeightKg truckId arrivedAt')
            .populate('requestedBy', 'name')
            .sort({ createdAt: -1 });
        res.json({ status: 'success', results: batches.length, data: batches });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/processing-batches/:id/assign-room
export const assignRoom = async (req, res) => {
    try {
        const { roomId } = req.body;
        if (!roomId) return res.status(400).json({ status: 'error', message: 'roomId is required.' });

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ status: 'error', message: 'Room not found.' });
        if (room.status === 'Maintenance') {
            return res.status(400).json({ status: 'error', message: 'Room is under maintenance and cannot accept batches.' });
        }

        const batch = await ProcessingBatch.findById(req.params.id);
        if (!batch) return res.status(404).json({ status: 'error', message: 'Batch not found.' });

        const incomingWeight = batch.receivedWeightKg || 0;
        const remainingCapacity = room.capacityKg - room.currentLoadKg;

        if (incomingWeight > remainingCapacity) {
            return res.status(400).json({
                status: 'error',
                message: `Insufficient space. Room "${room.name}" has ${remainingCapacity} kg remaining but batch requires ${incomingWeight} kg.`,
                data: {
                    roomCapacity: room.capacityKg,
                    currentLoad: room.currentLoadKg,
                    remaining: remainingCapacity,
                    batchWeight: incomingWeight,
                }
            });
        }

        // Assign room to batch
        const updatedBatch = await ProcessingBatch.findByIdAndUpdate(
            req.params.id,
            {
                assignedRoom: room.name,
                assignedRoomId: roomId,
                assignedBy: req.user._id,
                status: 'Processing'
            },
            { new: true }
        );

        // Add batch weight to room load, flip to In Use
        const newLoad = room.currentLoadKg + incomingWeight;
        await Room.findByIdAndUpdate(roomId, {
            currentLoadKg: newLoad,
            status: 'In Use',
        });

        // Notify QC officer
        await notifyByRole('quality_officer', {
            sender: req.user._id,
            type: 'ROOM_ASSIGNED',
            title: 'Processing Room Assigned',
            message: `Room "${room.name}" assigned for your processing batch. You can now begin.`,
            link: '/qc/processing',
        });

        await createEventLog({
            module: 'Production & QC',
            action: 'Room Assigned',
            severity: 'INFO',
            description: `Room "${room.name}" assigned to processing batch (${incomingWeight} kg added, ${newLoad} kg total load)`,
            actor: req.user.name,
            metadata: { batchId: updatedBatch._id, roomName: room.name, roomId, incomingWeight, newLoad }
        });

        res.json({ status: 'success', message: 'Room assigned.', data: updatedBatch });

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/processing-batches/:id/complete  ← QC logs weights
export const completeBatch = async (req, res) => {
    try {
        const { processedWeightKg, rejectedWeightKg, defectType, assignedGrade } = req.body;
        if (processedWeightKg == null || rejectedWeightKg == null) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'processedWeightKg, rejectedWeightKg required.' 
            });
        }

        const batch = await ProcessingBatch.findByIdAndUpdate(
            req.params.id,
            { 
                processedWeightKg, 
                rejectedWeightKg, 
                primaryDefectType: defectType,
                gradeLabel: assignedGrade,
                status: 'QCDone' 
            },
            { new: true }
        );
        if (!batch) return res.status(404).json({ 
            status: 'error', message: 'Batch not found.' 
        });

        // Room stays 'In Use' — PM will free it when confirming
        // Do NOT flip room back to Available here anymore

        // Notify PM to review and confirm
        await notifyByRole('production_manager', {
            type: 'QC_COMPLETED',
            title: 'QC Complete — Awaiting Your Confirmation',
            message: `${batch.cropName} processing done — ${processedWeightKg} kg approved, ${rejectedWeightKg} kg rejected. Review and confirm to add to stock.`,
            refId: batch._id,
            refModel: 'ProcessingBatch',
        });

        res.json({ status: 'success', message: 'QC complete. Awaiting PM confirmation.', data: batch });

        await createEventLog({
            module: 'Production & QC',
            action: 'QC Completed — Pending Confirmation',
            severity: 'INFO',
            description: `QC done: ${batch.cropName} — ${processedWeightKg} kg approved, ${rejectedWeightKg} kg rejected. Awaiting PM review.`,
            actor: req.user.name,
            metadata: { batchId: batch._id, processedWeightKg, rejectedWeightKg }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/processing-batches/:id/confirm  ← PM confirms QC result + optionally reassigns room
export const confirmBatch = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                status: 'error',
                message: 'A cold room must be selected to confirm stock.'
            });
        }

        const batch = await ProcessingBatch.findById(req.params.id);
        if (!batch) return res.status(404).json({ status: 'error', message: 'Batch not found.' });
        if (batch.status !== 'QCDone') return res.status(400).json({
            status: 'error', message: 'Batch is not in QCDone state.'
        });

        // Validate cold room
        const coldRoom = await Room.findById(roomId);
        if (!coldRoom) return res.status(404).json({ status: 'error', message: 'Cold room not found.' });
        if (coldRoom.status === 'Maintenance') return res.status(400).json({
            status: 'error', message: `Room "${coldRoom.name}" is under maintenance.`
        });

        const weightToStore = batch.processedWeightKg || 0;
        const coldRoomRemaining = coldRoom.capacityKg - (coldRoom.currentLoadKg || 0);

        if (weightToStore > coldRoomRemaining) {
            return res.status(400).json({
                status: 'error',
                message: `Insufficient space in "${coldRoom.name}". ${coldRoomRemaining} kg remaining, ${weightToStore} kg needed.`,
                data: {
                    roomCapacity: coldRoom.capacityKg,
                    currentLoad: coldRoom.currentLoadKg,
                    remaining: coldRoomRemaining,
                    required: weightToStore,
                }
            });
        }

        // Confirm the batch — save triggers STK- pre-save hook
        batch.status      = 'Done';
        batch.confirmedBy = req.user._id;
        batch.coldRoomId  = roomId;
        batch.coldRoomName = coldRoom.name;
        // Also update primary location fields to the cold room
        batch.assignedRoomId = roomId;
        batch.assignedRoom = coldRoom.name;
        await batch.save();

        // Recalculate room loads for all rooms (Processing & Cold)
        await syncAllRoomLoads();

        await notifyByRole('quality_officer', {
            type: 'STOCK_CONFIRMED',
            title: 'Stock Confirmed',
            message: `PM confirmed ${batch.cropName} — ${batch.processedWeightKg} kg added to stock as ${batch.stockId} in ${coldRoom.name}.`,
            refId: batch._id,
            refModel: 'ProcessingBatch',
        });

        res.json({ status: 'success', message: 'Stock confirmed and moved to cold storage.', data: batch });

        await createEventLog({
            module: 'Production & QC',
            action: 'Stock Confirmed',
            severity: 'INFO',
            description: `PM confirmed stock: ${batch.cropName} — ${batch.processedWeightKg} kg → ${batch.stockId} in cold room "${coldRoom.name}"`,
            actor: req.user.name,
            metadata: {
                batchId: batch._id,
                stockId: batch.stockId,
                processedWeightKg: batch.processedWeightKg,
                processingRoom: batch.assignedRoom,
                coldRoom: coldRoom.name,
            }
        });

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ── STOCK ─────────────────────────────────────────────────────────────────────

// GET /api/v1/stock  ← PM + QC see final stock
export const getStock = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = { status: 'Done' };
        if (startDate && endDate) {
            filter.updatedAt = {
                $gte: new Date(startDate),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }
        const batches = await ProcessingBatch.find(filter)
            .populate('intakeLogId', 'pickedUpWeightKg arrivedAt truckId')
            .populate({
                path: 'cycleId',
                select: 'crop_name farm_name farmer_id',
                populate: { path: 'farmer_id', select: 'full_name cooperative_name' }
            })
            .sort({ updatedAt: -1 });
        res.json({ status: 'success', results: batches.length, data: batches });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/intake-logs
export const getIntakeLogs = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = {};
        if (startDate && endDate) {
            filter.arrivedAt = {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }
        const logs = await IntakeLog.find(filter)
            .populate({
                path: 'harvestDeclarationId',
                populate: { path: 'farmerId', select: 'full_name' }
            })
            .populate('cycleId')
            .populate('loggedBy', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Manual population for truckId since it's a string that can be an ID or a legacy ref (like 'T2')
        const truckIds = logs.map(l => l.truckId).filter(id => id && mongoose.Types.ObjectId.isValid(id));
        const vehicles = await Vehicle.find({ _id: { $in: truckIds } }).lean();
        const drivers = await Driver.find({ assignedVehicle: { $ne: null } }).lean();
        
        // Find related processing batches to determine status
        const logIds = logs.map(l => l._id);
        const batches = await ProcessingBatch.find({ intakeLogId: { $in: logIds } }).lean();

        const logsWithFullData = logs.map(log => {
            // 1. Vehicle & Driver Logic
            if (log.truckId) {
                if (mongoose.Types.ObjectId.isValid(log.truckId)) {
                    const vehicle = vehicles.find(v => v._id.toString() === log.truckId.toString());
                    if (vehicle) {
                        const driver = drivers.find(d => d.assignedVehicle?.toString() === vehicle._id.toString());
                        log.truckId = { ...vehicle, currentDriver: driver || null };
                    } else {
                        log.truckId = { plateNumber: log.truckId, currentDriver: null };
                    }
                } else {
                    log.truckId = { plateNumber: log.truckId, currentDriver: null };
                }
            }

            // 2. Status Logic (based on ProcessingBatch)
            const batch = batches.find(b => b.intakeLogId.toString() === log._id.toString());
            log.status = batch ? batch.status : 'AwaitingQC';

            return log;
        });

        res.json({ status: 'success', results: logsWithFullData.length, data: logsWithFullData });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/processing-batches  ← PM/admin sees ALL batches, all statuses
export const getAllBatches = async (req, res) => {
    try {
        const batches = await ProcessingBatch.find({})
            .populate('intakeLogId', 'pickedUpWeightKg arrivedAt truckId')
            .populate('requestedBy', 'name role')
            .populate('assignedBy', 'name role')
            .populate('confirmedBy', 'name role')
            .populate({
                path: 'cycleId',
                select: 'crop_name farm_name farmer_id cycleId',
                populate: { path: 'farmer_id', select: 'full_name cooperative_name' }
            })
            .sort({ updatedAt: -1 });
        res.json({ status: 'success', results: batches.length, data: batches });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/processing-batches/:id/spoil  ← PM marks stock as spoiled
export const spoilBatch = async (req, res) => {
    try {
        const batch = await ProcessingBatch.findById(req.params.id);
        if (!batch) return res.status(404).json({ status: 'error', message: 'Batch not found.' });
        if (batch.status !== 'Done') return res.status(400).json({ 
            status: 'error', message: 'Only confirmed stock can be marked as spoiled.' 
        });

        // Update status
        batch.status = 'Spoiled';
        await batch.save();

        // Recalculate room loads
        await syncAllRoomLoads();

        await createEventLog({
            module: 'Production & QC',
            action: 'Stock Marked Spoiled',
            severity: 'WARNING',
            description: `Stock ${batch.stockId} marked as spoiled — ${batch.processedWeightKg} kg ${batch.cropName} written off`,
            actor: req.user.name,
            metadata: { batchId: batch._id, stockId: batch.stockId, weightKg: batch.processedWeightKg }
        });

        res.json({ status: 'success', message: 'Stock marked as spoiled.', data: batch });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};