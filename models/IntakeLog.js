import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    harvestDeclarationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HarvestDeclaration', required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    pickedUpWeightKg: { type: Number, required: true },
    truckId: { type: String },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    arrivedAt: { type: Date, default: Date.now },
}, { timestamps: true });
export default mongoose.model('IntakeLog', schema);