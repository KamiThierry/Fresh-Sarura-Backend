import Room from '../models/Room.js';
import ProcessingBatch from '../models/ProcessingBatch.js';
import ExportBatch from '../models/ExportBatch.js';

// Internal utility to sync all room loads with actual batches
export const syncAllRoomLoads = async () => {
    const rooms = await Room.find({});
    
    // Aggregation to get total allocation per processing batch
    const allocations = await ExportBatch.aggregate([
        { $group: { _id: '$processingBatchId', totalAllocated: { $sum: '$allocatedWeightKg' } } }
    ]);
    const allocationMap = allocations.reduce((acc, curr) => {
        acc[curr._id.toString()] = curr.totalAllocated;
        return acc;
    }, {});

    for (const room of rooms) {
        // Find batches where this room is either the processing area or the designated cold storage
        const candidates = await ProcessingBatch.find({
            $or: [
                { assignedRoomId: room._id },
                { coldRoomId: room._id }
            ],
            status: { $in: ['Processing', 'QCDone', 'Done'] }
        });

        // Resolve current location: if Done and has coldRoomId, it only belongs to the cold room.
        // Otherwise, it belongs to its assignedRoomId.
        const activeBatches = candidates.filter(b => {
            if (b.status === 'Done' && b.coldRoomId) {
                return b.coldRoomId.toString() === room._id.toString();
            }
            return b.assignedRoomId?.toString() === room._id.toString();
        });

        const totalLoad = activeBatches.reduce((sum, b) => {
            // Priority: processedWeight (if done) -> receivedWeight (if processing) -> 0
            const actualWeight = Number(b.processedWeightKg || b.receivedWeightKg || 0);
            const allocated = Number(allocationMap[b._id.toString()] || 0);
            const available = Math.max(0, actualWeight - allocated);
            return sum + available;
        }, 0);

        // Update room status based on load
        let status = room.status;
        if (status !== 'Maintenance') {
            status = totalLoad > 0 ? 'In Use' : 'Available';
        }

        await Room.findByIdAndUpdate(room._id, {
            currentLoadKg: totalLoad,
            status
        });
    }
};

// GET /api/v1/rooms
export const getRooms = async (req, res) => {
    try {
        // Sync before returning to ensure real-time accuracy
        await syncAllRoomLoads();
        
        const filter = req.query.status ? { status: req.query.status } : {};
        const rooms = await Room.find(filter).sort({ createdAt: -1 });
        res.json({ status: 'success', results: rooms.length, data: rooms });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// POST /api/v1/rooms
export const createRoom = async (req, res) => {
    try {
        const { name, type, capacityKg } = req.body;
        if (!name || !capacityKg) {
            return res.status(400).json({ status: 'error', message: 'name and capacityKg are required.' });
        }
        const room = await Room.create({
            name,
            type: type || 'Processing',
            capacityKg: Number(capacityKg),
            currentLoadKg: 0,
            createdBy: req.user._id,
        });
        res.status(201).json({ status: 'success', data: room });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/rooms/:id
export const updateRoom = async (req, res) => {
    try {
        const { name, type, capacityKg, status } = req.body;

        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ status: 'error', message: 'Room not found.' });

        // Prevent flipping to Maintenance if batches are currently using it
        if (status === 'Maintenance') {
            const activeBatches = await ProcessingBatch.countDocuments({
                assignedRoomId: room._id,
                status: { $in: ['Processing', 'RoomRequested'] }
            });
            if (activeBatches > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Cannot set to Maintenance — ${activeBatches} active batch(es) still assigned to this room.`
                });
            }
        }

        // Prevent shrinking capacity below current load
        if (capacityKg && Number(capacityKg) < room.currentLoadKg) {
            return res.status(400).json({
                status: 'error',
                message: `New capacity (${capacityKg} kg) cannot be less than current load (${room.currentLoadKg} kg).`
            });
        }

        const updated = await Room.findByIdAndUpdate(
            req.params.id,
            {
                ...(name && { name }),
                ...(type && { type }),
                ...(capacityKg && { capacityKg: Number(capacityKg) }),
                ...(status && { status }),
            },
            { new: true, runValidators: true }
        );

        res.json({ status: 'success', data: updated });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/rooms/:id/expand  — increase capacity
export const expandCapacity = async (req, res) => {
    try {
        const { additionalKg } = req.body;
        if (!additionalKg || Number(additionalKg) <= 0) {
            return res.status(400).json({ status: 'error', message: 'additionalKg must be a positive number.' });
        }

        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ status: 'error', message: 'Room not found.' });

        const newCapacity = room.capacityKg + Number(additionalKg);
        const updated = await Room.findByIdAndUpdate(
            req.params.id,
            { capacityKg: newCapacity },
            { new: true }
        );

        res.json({
            status: 'success',
            message: `Room capacity expanded from ${room.capacityKg} kg to ${newCapacity} kg.`,
            data: updated
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/rooms/:id/clear  — PM manually clears room load
export const clearRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ status: 'error', message: 'Room not found.' });

        // Update any active batches in this room to be 'Spoiled' so they no longer consume space
        await ProcessingBatch.updateMany({
            $or: [
                { assignedRoomId: room._id },
                { coldRoomId: room._id }
            ],
            status: { $in: ['Processing', 'QCDone', 'Done'] }
        }, {
            status: 'Spoiled'
        });

        const updated = await Room.findByIdAndUpdate(
            req.params.id,
            { currentLoadKg: 0, status: 'Available' },
            { new: true }
        );

        await syncAllRoomLoads();

        res.json({
            status: 'success',
            message: `Room "${room.name}" cleared and marked as Available. Associated stock was marked as Spoiled.`,
            data: updated
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

export const getRoomBatches = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ status: 'error', message: 'Room not found.' });

        // Find batches where this room is either the processing area or the designated cold storage
        const candidates = await ProcessingBatch.find({
            $or: [
                { assignedRoomId: room._id },
                { coldRoomId: room._id }
            ],
            status: { $in: ['Processing', 'QCDone', 'Done'] }
        }).populate('requestedBy', 'name')
          .sort({ updatedAt: -1 })
          .lean();

        // Filter to only include batches currently residing in this room
        const enrichedBatches = candidates.filter(b => {
            if (b.status === 'Done' && b.coldRoomId) {
                return b.coldRoomId.toString() === room._id.toString();
            }
            return b.assignedRoomId?.toString() === room._id.toString();
        });
        
        const batchIds = enrichedBatches.map(b => b._id);
        const allocations = await ExportBatch.aggregate([
            { $match: { processingBatchId: { $in: batchIds } } },
            { $group: { _id: '$processingBatchId', totalAllocated: { $sum: '$allocatedWeightKg' } } }
        ]);
        const allocationMap = allocations.reduce((acc, curr) => {
            acc[curr._id.toString()] = curr.totalAllocated;
            return acc;
        }, {});

        const enriched = enrichedBatches.map(b => {
            const actual = Number(b.processedWeightKg || b.receivedWeightKg || 0);
            const allocated = Number(allocationMap[b._id.toString()] || 0);
            return {
                ...b,
                availableWeightKg: Math.max(0, actual - allocated),
                totalAllocatedKg: allocated
            };
        });
          
        res.json({ status: 'success', results: enriched.length, data: enriched });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
