import mongoose from 'mongoose';

const packagingStockSchema = new mongoose.Schema({
    vendor: { type: String, required: true },
    pricePerBox: { type: Number, required: true },
    quantityReceived: { type: Number, required: true },
    quantityAvailable: { type: Number, required: true },
    receivedDate: { type: Date, required: true },
    notes: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'depleted'], default: 'active' },
    consumptionLog: [
        {
            boxesUsed: { type: Number, required: true },
            exportBatchRef: { type: String }, // e.g. batch ID or client name for display
            consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            consumedAt: { type: Date, default: Date.now },
        }
    ]
}, { timestamps: true });

const PackagingStock = mongoose.model('PackagingStock', packagingStockSchema);
export default PackagingStock;
