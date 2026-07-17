import mongoose from 'mongoose';

const packagingStockSchema = new mongoose.Schema({
    supplier: { type: String, required: true },
    materialType: { type: String, required: true, default: 'Box' },
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

// Compound index to prevent duplicate material types from same supplier
packagingStockSchema.index({ supplier: 1, materialType: 1 }, { unique: true });

// Virtual getter/setter for backward compatibility with 'vendor'
packagingStockSchema.virtual('vendor').get(function() {
    return this.supplier;
}).set(function(v) {
    this.supplier = v;
});

// Ensure virtuals are serialized
packagingStockSchema.set('toJSON', { virtuals: true });
packagingStockSchema.set('toObject', { virtuals: true });

const PackagingStock = mongoose.model('PackagingStock', packagingStockSchema);
export default PackagingStock;
