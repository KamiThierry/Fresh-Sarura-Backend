import mongoose from 'mongoose';
import ExportBatch from '../models/ExportBatch.js';
import ProcessingBatch from '../models/ProcessingBatch.js';
import IntakeLog from '../models/IntakeLog.js';
import HarvestDeclaration from '../models/HarvestDeclaration.js';
import CropCycle from '../models/CropCycle.js';
import Shipment from '../models/Shipment.js';
import Farmer from '../models/Farmer.js';
import Vehicle from '../models/Vehicle.js';
import Driver from '../models/Driver.js';

export const getTraceabilityData = async (req, res) => {
    try {
        const { id } = req.params;
        let exportBatch = null;
        let processingBatch = null;

        // ── Resolve entry point ──
        if (id.startsWith('EB-')) {
            exportBatch = await ExportBatch.findOne({ batchId: id });
            if (!exportBatch) {
                return res.status(404).json({
                    status: 'fail',
                    message: `Export batch "${id}" not found.`
                });
            }
            processingBatch = await ProcessingBatch.findById(exportBatch.processingBatchId);
            if (!processingBatch && exportBatch.cycleId) {
                processingBatch = await ProcessingBatch.findOne({
                    cycleId: exportBatch.cycleId,
                    status: 'Done'
                });
            }

        } else if (id.startsWith('STK-')) {
            processingBatch = await ProcessingBatch.findOne({ stockId: id });
            if (!processingBatch) {
                return res.status(404).json({
                    status: 'fail',
                    message: `Stock batch "${id}" not found.`
                });
            }
            // Only fetch export batch if one actually exists for this stock
            exportBatch = await ExportBatch.findOne({
                processingBatchId: processingBatch._id
            });

        } else {
            return res.status(400).json({
                status: 'fail',
                message: `Invalid ID format. Use EB-XXXXXX or STK-XXXXXX.`
            });
        }

        // ── Trace backwards through the chain ──
        const intake = processingBatch
            ? await IntakeLog.findById(processingBatch.intakeLogId)
            : null;

        const harvest = intake
            ? await HarvestDeclaration.findById(intake.harvestDeclarationId)
            : null;

        const cycleId = processingBatch?.cycleId || exportBatch?.cycleId;
        const cycle = cycleId ? await CropCycle.findById(cycleId) : null;
        const farmer = cycle?.farmer_id
            ? await Farmer.findById(cycle.farmer_id)
            : null;

        // ── Vehicle and driver lookup ──
        // truckId stores a short alias (e.g. "T1"), not a plate number.
        // Reliable lookup: find driver who has an assigned vehicle, get vehicle from driver.
        let vehicle = null;
        let driver = null;

        driver = await Driver.findOne({ assignedVehicle: { $ne: null } })
          .populate('assignedVehicle');

        if (driver?.assignedVehicle) {
          vehicle = driver.assignedVehicle;
        }

        // ── Shipment — only if export batch exists and shipment is not cancelled ──
        const shipment = exportBatch
            ? await Shipment.findOne({
                exportBatches: exportBatch._id,
                status: { $ne: 'Cancelled' }
              })
            : null;

        // Fetch ALL export batches for this stock to calculate total allocations
        const allExports = processingBatch 
            ? await ExportBatch.find({ processingBatchId: processingBatch._id })
            : [];
        const totalAllocated = allExports.reduce((sum, eb) => sum + (eb.allocatedWeightKg || 0), 0);
        const stockedWeight = Math.max(0, (processingBatch?.processedWeightKg || 0) - totalAllocated);

        // ── Build nodes ──
        const nodes = [];

        // Node 1 — Farm origin
        nodes.push({
            id: 'source',
            type: 'source',
            title: `Origin: ${harvest?.farmName || farmer?.cooperative_name || farmer?.full_name || 'Sarura Partner Farm'}`,
            details: [
                { label: 'Farmer',      value: farmer?.full_name || 'N/A' },
                { label: 'Crop',        value: harvest?.cropName || cycle?.crop_name || exportBatch?.cropName || 'N/A' },
                { label: 'Declared',    value: harvest?.createdAt ? new Date(harvest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A' },
                { label: 'Location',    value: [farmer?.district, farmer?.sector].filter(Boolean).join(', ') || 'Rwanda' },
                { label: 'Est. Weight', value: harvest?.estimatedWeightKg ? `${harvest.estimatedWeightKg} kg` : 'N/A' },
            ],
            badges: [{ label: 'Farmer Status', value: farmer?.status || 'Active' }],
            action: {
                label: 'View Farmer Profile',
                link: farmer?._id ? `/pm/farmers?profileId=${farmer._id}` : '/pm/farmers'
            }
        });

        // Node 2 — Field pickup & intake
        if (intake) {
            nodes.push({
                id: 'intake',
                type: 'intake',
                title: 'Field Pickup & Intake',
                details: [
                    {
                        label: 'Arrived At',
                        value: intake.arrivedAt
                            ? new Date(intake.arrivedAt).toLocaleString('en-GB', {
                                day: '2-digit', month: 'short',
                                hour: '2-digit', minute: '2-digit'
                              })
                            : 'N/A'
                    },
                    { label: 'Picked Up Weight', value: `${intake.pickedUpWeightKg} kg` },
                    {
                        label: 'Vehicle',
                        value: vehicle
                            ? `${vehicle.plateNumber} — ${vehicle.type} (${vehicle.capacityKg} kg cap.)`
                            : (intake.truckId || 'Not recorded')
                    },
                    {
                        label: 'Driver',
                        value: driver
                            ? `${driver.firstName} ${driver.lastName} · ${driver.phoneNumber}`
                            : 'Not assigned'
                    },
                ],
                action: null
            });
        }

        // Node 3 — Packhouse processing
        if (processingBatch) {
            nodes.push({
                id: 'stock',
                type: 'stock',
                title: `Packhouse: ${processingBatch.stockId || 'Processing Complete'}`,
                details: [
                    { label: 'Stock ID',  value: processingBatch.stockId || 'Pending confirmation' },
                    { label: 'Room',      value: processingBatch.assignedRoom || 'N/A' },
                    { label: 'Received',  value: processingBatch.receivedWeightKg ? `${processingBatch.receivedWeightKg} kg` : 'N/A' },
                    { label: 'Processed', value: processingBatch.processedWeightKg ? `${processingBatch.processedWeightKg} kg` : 'Not logged yet' },
                    { label: 'Stocked',   value: `${stockedWeight} kg`, highlight: 'text-emerald-600 font-bold' },
                    { label: 'Rejected',  value: processingBatch.rejectedWeightKg != null ? `${processingBatch.rejectedWeightKg} kg` : 'Not logged yet' },
                    {
                        label: 'Status',
                        value: processingBatch.status,
                        highlight: processingBatch.status === 'Done' ? 'text-green-600 font-bold' : ''
                    },
                ],
                action: null
            });
        }

        // Node 4 — Export batch (only if one exists for this stock)
        if (exportBatch) {
            let displayStatus = exportBatch.status;
            if (shipment) {
                if (shipment.status === 'PackingListGenerated' || shipment.status === 'Draft') {
                    displayStatus = 'Scheduled';
                } else if (shipment.status === 'Departed') {
                    displayStatus = 'In Transit';
                } else if (shipment.status === 'Shipped') {
                    displayStatus = 'Shipped';
                }
            } else {
                if (exportBatch.status === 'ReadyForExport') {
                    displayStatus = 'Ready for Export';
                }
            }

            const friendlyShipmentStatus = shipment
                ? (shipment.status === 'PackingListGenerated' || shipment.status === 'Draft' ? 'Scheduled' : (shipment.status === 'Departed' ? 'In Transit' : shipment.status))
                : '';

            nodes.push({
                id: 'export',
                type: 'export',
                title: `Export Batch: ${exportBatch.batchId}`,
                details: [
                    { label: 'Client',      value: exportBatch.clientName },
                    { label: 'Destination', value: exportBatch.destination },
                    { label: 'Weight',      value: `${exportBatch.allocatedWeightKg} kg` },
                    { label: 'Boxes',       value: String(exportBatch.boxCount) },
                    { label: 'Grade',       value: exportBatch.gradeLabel || '—' },
                    {
                        label: 'Status',
                        value: displayStatus,
                        highlight: displayStatus === 'Shipped' ? 'text-green-600 font-bold' : (displayStatus === 'Scheduled' ? 'text-amber-500 font-bold' : '')
                    },
                ],
                action: shipment
                    ? { label: `Shipment ${shipment.plNumber} — ${friendlyShipmentStatus}`, link: '/pm/inventory' }
                    : null
            });
        }

        // Node 5 — Shipment (only if exists and not cancelled)
        if (shipment) {
            const displayShipmentStatus = shipment.status === 'PackingListGenerated' || shipment.status === 'Draft'
                ? 'Scheduled'
                : (shipment.status === 'Departed' ? 'In Transit' : shipment.status);

            nodes.push({
                id: 'shipment',
                type: 'shipment',
                title: `Shipment: ${shipment.plNumber}`,
                details: [
                    { label: 'Flight',       value: shipment.flightNumber || 'N/A' },
                    { label: 'Destination',  value: shipment.destination || 'N/A' },
                    {
                        label: 'Departure',
                        value: shipment.departureDate
                            ? new Date(shipment.departureDate).toLocaleDateString('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })
                            : 'N/A'
                    },
                    { label: 'Total Weight', value: shipment.totalWeightKg ? `${shipment.totalWeightKg} kg` : 'N/A' },
                    { label: 'Total Boxes',  value: shipment.totalBoxes ? String(shipment.totalBoxes) : 'N/A' },
                    {
                        label: 'Status',
                        value: displayShipmentStatus,
                        highlight: (shipment.status === 'Shipped' || shipment.status === 'Departed') ? 'text-green-600 font-bold' : 'text-amber-500 font-bold'
                    },
                ],
                action: null
            });
        }

        res.status(200).json({
            status: 'success',
            data: { batchId: id, nodes }
        });

    } catch (err) {
        console.error('Traceability Error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};
