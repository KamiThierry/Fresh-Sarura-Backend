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

// Migrate legacy docs: copy 'vendor' → 'supplier' before validation
packagingStockSchema.pre('validate', function (next) {
    // _doc holds the raw DB fields — virtual 'vendor' getter would just return this.supplier
    if (!this.supplier && this._doc.vendor) {
        this.supplier = this._doc.vendor;
    }
    if (!this.materialType) {
        this.materialType = 'Box';
    }
    next();
});

// Compound index to prevent duplicate material types from same supplier
packagingStockSchema.index({ supplier: 1, materialType: 1 }, { unique: true });

const PackagingStock = mongoose.model('PackagingStock', packagingStockSchema);
export default PackagingStock;
