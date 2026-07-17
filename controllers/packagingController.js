import PackagingStock from '../models/PackagingStock.js';
import { createEventLog } from './eventLogController.js';

// GET /api/v1/packaging/summary — used by the modal
export const getPackagingSummary = async (req, res) => {
    try {
        const lots = await PackagingStock.find({ status: 'active' }).sort({ createdAt: 1 });

        const totalAvailable = lots.reduce((sum, l) => sum + l.quantityAvailable, 0);

        // Current price = price from the most recent restock across all active lots
        const allRestocks = lots.flatMap(l =>
            (l.restockHistory?.length ? l.restockHistory : [{ pricePerBox: l.pricePerBox, date: l.receivedDate }])
        ).sort((a, b) => new Date(b.date) - new Date(a.date));

        const currentPricePerBox = allRestocks[0]?.pricePerBox || 0;
        const totalStockValue = lots.reduce((sum, l) => sum + (l.quantityAvailable * l.pricePerBox), 0);

        res.json({
            status: 'success',
            data: {
                totalAvailableBoxes: totalAvailable,
                currentPricePerBox,
                totalStockValue,
                lots: lots.map(l => ({
                    _id: l._id,
                    vendor: l.supplier,
                    supplier: l.supplier,
                    materialType: l.materialType,
                    pricePerBox: l.pricePerBox,
                    quantityAvailable: l.quantityAvailable,
                    receivedDate: l.receivedDate,
                    restockHistory: l.restockHistory,
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

// POST /api/v1/packaging — create new supplier packaging material
export const receivePackagingStock = async (req, res) => {
    try {
        const { supplier, vendor, materialType, pricePerBox, quantityReceived, receivedDate, notes } = req.body;
        const effectiveSupplier = (supplier || vendor || '').trim();
        const effectiveMaterialType = (materialType || 'Box').trim();

        if (!effectiveSupplier || !pricePerBox || !quantityReceived || !receivedDate) {
            return res.status(400).json({ message: 'supplier, pricePerBox, quantityReceived, and receivedDate are required.' });
        }

        // Check if supplier already has this material type
        const existing = await PackagingStock.findOne({ 
            supplier: effectiveSupplier, 
            materialType: effectiveMaterialType 
        });
        if (existing) {
            return res.status(409).json({
                message: `"${effectiveSupplier}" already has a delivery for "${effectiveMaterialType}". Use the Restock option to add more quantity to this delivery.`,
                code: 'VENDOR_EXISTS',
                existingId: existing._id,
            });
        }

        const lot = await PackagingStock.create({
            supplier: effectiveSupplier,
            materialType: effectiveMaterialType,
            pricePerBox,
            totalReceived: quantityReceived,
            quantityAvailable: quantityReceived,
            receivedDate,
            notes,
            receivedBy: req.user._id,
            restockHistory: [{
                quantityAdded: quantityReceived,
                pricePerBox,
                date: receivedDate,
                addedBy: req.user._id,
                notes: notes || 'Initial stock',
            }]
        });

        await createEventLog({
            module: 'Inventory',
            action: 'Packaging Stock Created',
            actor: req.user.name,
            description: `${quantityReceived} ${effectiveMaterialType}s of ${effectiveSupplier} added at ${pricePerBox} Rwf/unit`,
            severity: 'INFO',
        });

        res.status(201).json({ status: 'success', data: lot });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/v1/packaging/:id/restock — add more boxes to existing supplier
export const restockPackagingStock = async (req, res) => {
    try {
        const { quantityAdded, pricePerBox, notes } = req.body;
        if (!quantityAdded || quantityAdded <= 0) {
            return res.status(400).json({ message: 'quantityAdded must be greater than 0.' });
        }

        const lot = await PackagingStock.findById(req.params.id);
        if (!lot) return res.status(404).json({ message: 'Packaging stock not found.' });

        const effectivePrice = pricePerBox || lot.pricePerBox;

        lot.quantityAvailable += quantityAdded;
        lot.totalReceived += quantityAdded;
        lot.pricePerBox = effectivePrice;
        lot.status = 'active';
        lot.restockHistory.push({
            quantityAdded,
            pricePerBox: effectivePrice,
            date: new Date(),
            addedBy: req.user._id,
            notes: notes || '',
        });

        await lot.save();

        await createEventLog({
            module: 'Inventory',
            action: 'Packaging Stock Restocked',
            actor: req.user.name,
            description: `${quantityAdded} units added to ${lot.supplier} (${lot.materialType}) — new total: ${lot.quantityAvailable}`,
            severity: 'INFO',
        });

        res.json({ status: 'success', data: lot });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/v1/packaging/consume — called when export batch is created
export const consumePackagingStock = async (req, res) => {
    try {
        const { boxesNeeded, lotId, exportBatchRef } = req.body;

        if (!boxesNeeded || boxesNeeded <= 0) {
            return res.status(400).json({ status: 'error', message: 'boxesNeeded must be greater than 0.' });
        }

        let lots = [];
        if (lotId) {
            const selectedLot = await PackagingStock.findOne({
                _id: lotId, status: 'active', quantityAvailable: { $gt: 0 }
            });
            if (selectedLot) lots.push(selectedLot);
        }
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
                message: `Only ${totalAvailable} units available. ${boxesNeeded} requested.`,
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
            description: `${boxesNeeded} units consumed${exportBatchRef ? ` for ${exportBatchRef}` : ''}`,
            severity: 'INFO',
        });

        res.json({ status: 'success', remainingBoxes: totalAvailable - boxesNeeded });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/packaging/:id — update a packaging supplier record
export const updatePackagingStock = async (req, res) => {
    try {
        const { supplier, vendor, materialType, pricePerBox, totalReceived, quantityReceived, receivedDate, notes } = req.body;
        const lot = await PackagingStock.findById(req.params.id);

        if (!lot) {
            return res.status(404).json({ status: 'error', message: 'Packaging lot not found' });
        }

        const effectiveTotalReceived = totalReceived !== undefined ? totalReceived : quantityReceived;

        let newAvailable = lot.quantityAvailable;
        if (effectiveTotalReceived !== undefined) {
            const diff = effectiveTotalReceived - lot.totalReceived;
            newAvailable = lot.quantityAvailable + diff;

            if (newAvailable < 0) {
                return res.status(400).json({ status: 'error', message: 'Cannot reduce received quantity below what has already been consumed.' });
            }
        }

        lot.supplier = supplier || vendor || lot.supplier;
        lot.materialType = materialType || lot.materialType;
        lot.pricePerBox = pricePerBox || lot.pricePerBox;
        
        if (effectiveTotalReceived !== undefined) {
            lot.totalReceived = effectiveTotalReceived;
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
            description: `Updated packaging stock for ${lot.supplier} (${lot.materialType})`,
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
            description: `Deleted packaging stock for ${lot.supplier} (${lot.materialType})`,
            severity: 'WARNING',
        });

        res.json({ status: 'success', message: 'Packaging lot deleted' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};
