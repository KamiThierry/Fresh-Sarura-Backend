import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EventLog from './models/EventLog.js';
import CropCycle from './models/CropCycle.js';
import ProcessingBatch from './models/ProcessingBatch.js';
import ExportBatch from './models/ExportBatch.js';
import Shipment from './models/Shipment.js';
import User from './models/User.js';
import Farmer from './models/Farmer.js';

dotenv.config();

const syncOldLogs = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        let createdCount = 0;

        // 1. Fetch CropCycles
        const cycles = await CropCycle.find().populate('registeredBy', 'name');
        for (const c of cycles) {
            const existing = await EventLog.findOne({ module: 'Crop Planning', action: 'Crop Cycle Created', 'metadata.cycleId': c.cycleId });
            if (!existing) {
                await EventLog.create({
                    module: 'Crop Planning',
                    action: 'Crop Cycle Created',
                    severity: 'INFO',
                    description: `New crop cycle created: ${c.crop_name} for ${c.farm_name} (${c.season})`,
                    actor: c.registeredBy?.name || 'System',
                    metadata: { cycleId: c.cycleId, cropName: c.crop_name, farmName: c.farm_name, season: c.season },
                    timestamp: c.createdAt || new Date()
                });
                createdCount++;
            }
        }

        // 2. Fetch Processing Batches
        const batches = await ProcessingBatch.find().populate('requestedBy', 'name');
        for (const b of batches) {
            const existing = await EventLog.findOne({ module: 'Production & QC', action: 'Room Requested', 'metadata.batchId': b._id });
            if (!existing) {
                await EventLog.create({
                    module: 'Production & QC',
                    action: 'Room Requested',
                    severity: 'INFO',
                    description: `Processing room requested for ${b.cropName || 'produce'} (${b.receivedWeightKg} kg)`,
                    actor: b.requestedBy?.name || 'System',
                    metadata: { batchId: b._id, receivedWeightKg: b.receivedWeightKg, cropName: b.cropName },
                    timestamp: b.createdAt || new Date()
                });
                createdCount++;
            }
        }

        // 3. Fetch Export Batches
        const exportBatches = await ExportBatch.find().populate('createdBy', 'name');
        for (const e of exportBatches) {
            const existing = await EventLog.findOne({ module: 'Production & QC', action: 'Export Batch Created', 'metadata.batchId': e._id });
            if (!existing) {
                await EventLog.create({
                    module: 'Production & QC',
                    action: 'Export Batch Created',
                    severity: 'INFO',
                    description: `Export batch created: ${e.cropName} — ${e.boxCount} boxes for ${e.clientName} to ${e.destination}`,
                    actor: e.createdBy?.name || 'System',
                    metadata: { batchId: e._id, cropName: e.cropName, clientName: e.clientName, destination: e.destination, boxCount: e.boxCount, weightKg: e.allocatedWeightKg },
                    timestamp: e.createdAt || new Date()
                });
                createdCount++;
            }
        }

        // 4. Fetch Shipments
        const shipments = await Shipment.find().populate('createdBy', 'name');
        for (const s of shipments) {
            const existing = await EventLog.findOne({ module: 'Export & Shipments', action: 'Shipment Created', 'metadata.shipmentId': s._id });
            if (!existing) {
                await EventLog.create({
                    module: 'Export & Shipments',
                    action: 'Shipment Created',
                    severity: 'INFO',
                    description: `Packing list ${s.plNumber} generated — Flight ${s.flightNumber} to ${s.destination}`,
                    actor: s.createdBy?.name || 'System',
                    metadata: { shipmentId: s._id, plNumber: s.plNumber, flightNumber: s.flightNumber, destination: s.destination, weightKg: s.totalWeightKg, boxes: s.totalBoxes },
                    timestamp: s.createdAt || new Date()
                });
                createdCount++;
            }
        }

        console.log(`Successfully backfilled ${createdCount} missing event logs.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
syncOldLogs();
