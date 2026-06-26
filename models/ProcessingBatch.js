import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    intakeLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntakeLog', required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedRoom: { type: String },
    assignedRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    assignedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    coldRoomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    coldRoomName:      { type: String },
    receivedWeightKg:  { type: Number },
    processedWeightKg: { type: Number },
    rejectedWeightKg:  { type: Number },
    gradeLabel:        { type: String },
    primaryDefectType: { type: String },
    cropName:          { type: String },
    status: {
        type: String,
        enum: ['RoomRequested', 'Processing', 'QCDone', 'Done', 'Spoiled'],
        default: 'RoomRequested'
    },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stockId: { type: String, unique: true, sparse: true },
}, { timestamps: true });

schema.pre('save', async function (next) {
    if (!this.stockId && this.status === 'Done') {
        const uniqueSuffix = Math.random().toString(36)
            .substring(2, 8).toUpperCase();
        this.stockId = `STK-${uniqueSuffix}`;
    }
    next();
});
export default mongoose.model('ProcessingBatch', schema);