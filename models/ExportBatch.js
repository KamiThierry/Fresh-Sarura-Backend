import mongoose from 'mongoose';

const exportBatchSchema = new mongoose.Schema({
    batchId:            { type: String, unique: true },
    processingBatchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessingBatch', required: true },
    cycleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    cropName:           { type: String, required: true },
    clientName:         { type: String, required: true },
    destination:        { type: String, required: true },
    gradeLabel:         { type: String },
    allocatedWeightKg:  { type: Number, required: true },
    boxCount:           { type: Number, required: true },
    weightPerBoxKg:     { type: Number, required: true },
    targetShipmentDate: { type: Date },
    status:             { type: String, enum: ['Pending', 'ReadyForExport', 'Shipped'], default: 'Pending' },
    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // NEW — snapshot of every packaging material used on this batch.
    // Snapshotted at creation time so historical reports don't shift if a
    // vendor's price changes later (same principle as your stock lot pricing).
    packagingMaterials: [
        {
            lotId:        { type: mongoose.Schema.Types.ObjectId, ref: 'PackagingStock' },
            supplier:     { type: String, required: true },
            materialType: { type: String, required: true },
            unitsUsed:    { type: Number, required: true },
            pricePerUnit: { type: Number, required: true },
            subtotal:     { type: Number, required: true },
        }
    ],
    totalPackagingCost: { type: Number, default: 0 },

}, { timestamps: true });

exportBatchSchema.pre('save', async function (next) {
    if (!this.batchId) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.batchId = `EB-${uniqueSuffix}`;
    }
    next();
});

export default mongoose.model('ExportBatch', exportBatchSchema);
