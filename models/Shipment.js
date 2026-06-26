import mongoose from 'mongoose';

const shipmentSchema = new mongoose.Schema({
    plNumber:             { type: String, unique: true },
    flightNumber:         { type: String, required: true },
    airlineCode:          { type: String },
    destination:          { type: String, required: true },
    clientName:           { type: String },
    departureDate:        { type: Date, required: true },
    departureTime:        { type: String },
    estimatedFlightHours: { type: Number, default: 8 },
    awbNumber:            { type: String },
    invoiceNumber:        { type: String },
    exportBatches:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'ExportBatch' }],
    totalBoxes:           { type: Number, default: 0 },
    totalWeightKg:        { type: Number, default: 0 },
    skids:                { type: Number, default: 0 },
    notes:                { type: String },
    status: {
        type: String,
        enum: ['Draft', 'PackingListGenerated', 'Departed', 'Shipped', 'Cancelled'],
        default: 'Draft'
    },
    departedAt:           { type: Date },
    shippedAt:            { type: Date },
    cancelledAt:          { type: Date },
    cancellationReason:   { type: String },
    createdBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

shipmentSchema.pre('save', async function (next) {
    if (!this.plNumber) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.plNumber = `PL-${uniqueSuffix}`;
    }
    next();
});

export default mongoose.model('Shipment', shipmentSchema);
