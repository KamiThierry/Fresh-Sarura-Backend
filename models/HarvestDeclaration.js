import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    declaredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    estimatedWeightKg: { type: Number, required: true },
    cropName: { type: String, required: true },
    farmName: { type: String },
    notes: { type: String },
    status: { type: String, enum: ['Pending', 'PickedUp'], default: 'Pending' },
    intakeLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntakeLog' },
}, { timestamps: true });
export default mongoose.model('HarvestDeclaration', schema);