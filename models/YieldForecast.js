import mongoose from 'mongoose';

const yieldForecastSchema = new mongoose.Schema(
  {
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByName: { type: String },
    harvestDate: { type: Date, required: true },
    predictionKg: { type: Number, required: true },
    confidence: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    notes: { type: String },
    status: { type: String, enum: ['Pending', 'Verified'], default: 'Pending' },
    isReadByPM: { type: Boolean, default: false },
    pmReply: { type: String },
  },
  { timestamps: true }
);

const YieldForecast = mongoose.model('YieldForecast', yieldForecastSchema);
export default YieldForecast;
