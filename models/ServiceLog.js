import mongoose from 'mongoose';

const serviceLogSchema = new mongoose.Schema({
    vehicleId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    vehiclePlate: { type: String, required: true },
    reason:       { type: String, required: true },
    expectedReturnDate: { type: Date },
    actualReturnDate:   { type: Date },
    estimatedCostRwf:   { type: Number, default: 0 },
    loggedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:       { type: String, enum: ['Open', 'Closed'], default: 'Open' },
}, { timestamps: true });

export default mongoose.model('ServiceLog', serviceLogSchema);
