import PackagingStock from '../models/PackagingStock.js';
import { createEventLog } from './eventLogController.js';

// GET /api/v1/packaging/summary — used by the modal
export const getPackagingSummary = async (req, res) => {
    try {
        const lots = await PackagingStock.find({ status: 'active' }).sort({ createdAt: 1 });

        const totalAvailable = lots.reduce((sum, l) => sum + l.quantityAvailable, 0);
        const weightedPrice = totalAvailable > 0
            ? lots.reduce((sum, l) => sum + (l.pricePerBox * l.quantityAvailable), 0) / totalAvailable
            : 0;

        res.json({
            status: 'success',
            data: {
                totalAvailableBoxes: totalAvailable,
                averagePricePerBox: Math.round(weightedPrice),
                lots: lots.map(l => ({
                    _id: l._id,
                    vendor: l.vendor,
                    pricePerBox: l.pricePerBox,
                    quantityAvailable: l.quantityAvailable,
                    receivedDate: l.receivedDate,
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// GET /api/v1/packaging — all lots with full detail
export const getAllPackagingStock = async (req, res) => {
    try {
        const lots = await PackagingStock.find()
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 });
        res.json({ status: 'success', data: lots });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// POST /api/v1/packaging — receive new delivery
export const receivePackagingStock = async (req, res) => {
    try {
        const { vendor, pricePerBox, quantityReceived, receivedDate, notes } = req.body;

        if (!vendor || !pricePerBox || !quantityReceived || !receivedDate) {
            return res.status(400).json({ status: 'error', message: 'vendor, pricePerBox, quantityReceived, and receivedDate are required.' });
        }

        const lot = await PackagingStock.create({
            vendor,
            pricePerBox,
            quantityReceived,
            quantityAvailable: quantityReceived,
            receivedDate,
            notes,
            receivedBy: req.user._id,
        });

        await createEventLog({
            module: 'Production & QC',
            action: 'Packaging Stock Received',
            actor: req.user.name,
            description: `${quantityReceived} boxes received from ${vendor} at ${pricePerBox} Rwf/box`,
            severity: 'INFO',
        });

        res.status(201).json({ status: 'success', data: lot });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/packaging/consume — called when export batch is created
export const consumePackagingStock = async (req, res) => {
    try {
        const { boxesNeeded, lotId, exportBatchRef } = req.body;

        if (!boxesNeeded || boxesNeeded <= 0) {
            return res.status(400).json({ status: 'error', message: 'boxesNeeded must be greater than 0.' });
        }

        // Build lot list — selected lot first, then others by FIFO
        let lots = [];
        if (lotId) {
            const selectedLot = await PackagingStock.findOne({
                _id: lotId, status: 'active', quantityAvailable: { $gt: 0 }
            });
            if (selectedLot) lots.push(selectedLot);
        }
        // Add remaining active lots (excluding already added)
        const otherLots = await PackagingStock.find({
            status: 'active',
            quantityAvailable: { $gt: 0 },
            ...(lotId ? { _id: { $ne: lotId } } : {})
        }).sort({ createdAt: 1 });
        lots = [...lots, ...otherLots];

        const totalAvailable = lots.reduce((sum, l) => sum + l.quantityAvailable, 0);

        if (totalAvailable < boxesNeeded) {
            return res.status(400).json({
                status: 'error',
                code: 'INSUFFICIENT_BOXES',
                message: `Only ${totalAvailable} boxes available. ${boxesNeeded} requested.`,
                available: totalAvailable,
            });
        }

        let remaining = boxesNeeded;
        for (const lot of lots) {
            if (remaining <= 0) break;
            const deduct = Math.min(lot.quantityAvailable, remaining);
            lot.consumptionLog.push({
                boxesUsed: deduct,
                exportBatchRef: exportBatchRef || 'Export Batch',
                consumedBy: req.user._id,
                consumedAt: new Date(),
            });
            lot.quantityAvailable -= deduct;
            if (lot.quantityAvailable === 0) lot.status = 'depleted';
            await lot.save();
            remaining -= deduct;
        }

        await createEventLog({
            module: 'Inventory',
            action: 'Packaging Stock Consumed',
            actor: req.user.name,
            description: `${boxesNeeded} boxes consumed${exportBatchRef ? ` for ${exportBatchRef}` : ''}`,
            severity: 'INFO',
        });

        res.json({ status: 'success', remainingBoxes: totalAvailable - boxesNeeded });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/packaging/:id — update a packaging lot
export const updatePackagingStock = async (req, res) => {
    try {
        const { vendor, pricePerBox, quantityReceived, receivedDate, notes } = req.body;
        const lot = await PackagingStock.findById(req.params.id);

        if (!lot) {
            return res.status(404).json({ status: 'error', message: 'Packaging lot not found' });
        }

        // Adjust available quantity by the same difference
        let newAvailable = lot.quantityAvailable;
        if (quantityReceived !== undefined) {
            const diff = quantityReceived - lot.quantityReceived;
            newAvailable = lot.quantityAvailable + diff;

            if (newAvailable < 0) {
                return res.status(400).json({ status: 'error', message: 'Cannot reduce received quantity below what has already been consumed.' });
            }
        }

        lot.vendor = vendor || lot.vendor;
        lot.pricePerBox = pricePerBox || lot.pricePerBox;
        
        if (quantityReceived !== undefined) {
            lot.quantityReceived = quantityReceived;
            lot.quantityAvailable = newAvailable;
            lot.status = newAvailable === 0 ? 'depleted' : 'active';
        }
        
        if (receivedDate) lot.receivedDate = receivedDate;
        if (notes !== undefined) lot.notes = notes;

        await lot.save();

        await createEventLog({
            module: 'Inventory',
            action: 'Packaging Stock Updated',
            actor: req.user.name,
            description: `Updated packaging stock for ${lot.vendor}`,
            severity: 'INFO',
        });

        res.json({ status: 'success', data: lot });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/v1/packaging/:id — delete a packaging lot
export const deletePackagingStock = async (req, res) => {
    try {
        const lot = await PackagingStock.findById(req.params.id);

        if (!lot) {
            return res.status(404).json({ status: 'error', message: 'Packaging lot not found' });
        }

        if (lot.consumptionLog && lot.consumptionLog.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Cannot delete lot that has already been consumed. Delete the associated export batches first.' });
        }

        await lot.deleteOne();

        await createEventLog({
            module: 'Inventory',
            action: 'Packaging Stock Deleted',
            actor: req.user.name,
            description: `Deleted packaging stock for ${lot.vendor}`,
            severity: 'WARNING',
        });

        res.json({ status: 'success', message: 'Packaging lot deleted' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
