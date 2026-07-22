import PackagingStock from '../models/PackagingStock.js';
import { createEventLog } from './eventLogController.js';

// GET /api/v1/packaging/summary — used by the modal
export const getPackagingSummary = async (req, res) => {
    try {
        const lots = await PackagingStock.find({ status: 'active' }).sort({ createdAt: 1 });

        const totalAvailable = lots.reduce((sum, l) => sum + l.quantityAvailable, 0);
        const totalStockValue = lots.reduce((sum, l) => sum + (l.quantityAvailable * l.pricePerBox), 0);
        const averagePricePerBox = totalAvailable > 0 ? Math.round(totalStockValue / totalAvailable) : 0;

        res.json({
            status: 'success',
            data: {
                totalAvailableBoxes: totalAvailable,
                averagePricePerBox,
                totalStockValue,
                lots: lots.map(l => ({
                    _id: l._id,
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

        const mappedLots = lots.map(lot => {
            const lotObj = lot.toObject();
            if (!lotObj.supplier && lot._doc.vendor) {
                lotObj.supplier = lot._doc.vendor;
            }
            return lotObj;
        });

        res.json({ status: 'success', data: mappedLots });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// POST /api/v1/packaging — create new supplier packaging material
export const receivePackagingStock = async (req, res) => {
    try {
        const { supplier, materialType, pricePerBox, quantityReceived, receivedDate, notes } = req.body;
        const effectiveSupplier = (supplier || '').trim();
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
                code: 'SUPPLIER_EXISTS',
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

        // Backfill supplier for legacy docs that only have 'vendor'
        if (!lot.supplier && lot._doc.vendor) {
            lot.supplier = lot._doc.vendor;
        }
        if (!lot.materialType) {
            lot.materialType = 'Box';
        }

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
            // Backfill supplier for legacy docs
            if (!lot.supplier && lot._doc.vendor) lot.supplier = lot._doc.vendor;
            if (!lot.materialType) lot.materialType = 'Box';
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

// Internal helper — called from exportController.createExportBatch, not exposed as its own route.
// Validates ALL requested materials have sufficient stock BEFORE deducting ANY of them,
// so a batch never ends up partially charged if the 3rd material runs short.
export const consumeMultiplePackagingStock = async (materials, userId, exportBatchRef, session) => {
    if (!Array.isArray(materials) || materials.length === 0) {
        throw new Error('At least one packaging material is required.');
    }

    const lotIds = materials.map(m => m.lotId);
    const lots = await PackagingStock.find({ _id: { $in: lotIds } }).session(session);
    const lotMap = new Map(lots.map(l => [l._id.toString(), l]));

    // Pass 1: validate everything first
    const snapshot = [];
    for (const m of materials) {
        const lot = lotMap.get(String(m.lotId));
        if (!lot) {
            throw new Error(`Packaging lot ${m.lotId} not found.`);
        }
        if (!lot.supplier && lot._doc?.vendor) lot.supplier = lot._doc.vendor;
        if (!lot.materialType) lot.materialType = 'Box';

        const unitsUsed = Number(m.unitsUsed);
        if (!unitsUsed || unitsUsed <= 0) {
            throw new Error(`Invalid quantity for ${lot.supplier} (${lot.materialType}).`);
        }
        if (lot.status !== 'active' || lot.quantityAvailable < unitsUsed) {
            throw new Error(`Insufficient stock for ${lot.supplier} (${lot.materialType}). Available: ${lot.quantityAvailable}, requested: ${unitsUsed}.`);
        }

        snapshot.push({
            lotId: lot._id,
            supplier: lot.supplier,
            materialType: lot.materialType,
            unitsUsed,
            pricePerUnit: lot.pricePerBox,
            subtotal: lot.pricePerBox * unitsUsed,
        });
    }

    // Pass 2: everything validated — now safe to deduct
    for (const item of snapshot) {
        const lot = lotMap.get(String(item.lotId));
        lot.quantityAvailable -= item.unitsUsed;
        if (lot.quantityAvailable === 0) lot.status = 'depleted';
        lot.consumptionLog.push({
            boxesUsed: item.unitsUsed,
            exportBatchRef: exportBatchRef || 'Export Batch',
            consumedBy: userId,
            consumedAt: new Date(),
        });
        await lot.save({ session });
    }

    return snapshot;
};

// PATCH /api/v1/packaging/:id — update a packaging supplier record
export const updatePackagingStock = async (req, res) => {
    try {
        const { supplier, materialType, pricePerBox, totalReceived, quantityReceived, receivedDate, notes } = req.body;
        const lot = await PackagingStock.findById(req.params.id);

        if (!lot) {
            return res.status(404).json({ status: 'error', message: 'Packaging lot not found' });
        }

        // Backfill supplier for legacy docs
        if (!lot.supplier && lot._doc.vendor) lot.supplier = lot._doc.vendor;
        if (!lot.materialType) lot.materialType = 'Box';

        const effectiveTotalReceived = totalReceived !== undefined ? totalReceived : quantityReceived;

        let newAvailable = lot.quantityAvailable;
        if (effectiveTotalReceived !== undefined) {
            const diff = effectiveTotalReceived - lot.totalReceived;
            newAvailable = lot.quantityAvailable + diff;

            if (newAvailable < 0) {
                return res.status(400).json({ status: 'error', message: 'Cannot reduce received quantity below what has already been consumed.' });
            }
        }

        lot.supplier = supplier || lot.supplier;
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
