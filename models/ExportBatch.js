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
}, { timestamps: true });

exportBatchSchema.pre('save', async function (next) {
    if (!this.batchId) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.batchId = `EB-${uniqueSuffix}`;
    }
    next();
});

export default mongoose.model('ExportBatch', exportBatchSchema);
