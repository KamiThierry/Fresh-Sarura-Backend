import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Processing', 'Cold Room'], default: 'Processing' },
    capacityKg: { type: Number, required: true },
    currentLoadKg: { type: Number, default: 0 },
    status: { type: String, enum: ['Available', 'In Use', 'Maintenance'], default: 'Available' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('Room', roomSchema);
