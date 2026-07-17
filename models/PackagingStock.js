import mongoose from 'mongoose';

const packagingStockSchema = new mongoose.Schema({
    vendor: { type: String, required: true, unique: true }, // ← unique per brand now
    pricePerBox: { type: Number, required: true },
    totalReceived: { type: Number, required: true, default: 0 },
    quantityAvailable: { type: Number, required: true, default: 0 },
    receivedDate: { type: Date, required: true }, // first receipt date
    notes: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'depleted'], default: 'active' },
    restockHistory: [
        {
            quantityAdded: { type: Number, required: true },
            pricePerBox: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            notes: { type: String },
        }
    ],
    consumptionLog: [
        {
            boxesUsed: { type: Number, required: true },
            exportBatchRef: { type: String },
            consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            consumedAt: { type: Date, default: Date.now },
        }
    ]
}, { timestamps: true });

const PackagingStock = mongoose.model('PackagingStock', packagingStockSchema);
export default PackagingStock;
