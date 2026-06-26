import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['Refrigerated Truck', 'Standard Truck', 'Van', 'Pickup'], required: true },
  capacityKg: { type: Number, required: true },
  status: { type: String, enum: ['Available', 'On Trip', 'Maintenance'], default: 'Available' },
  nextMaintenanceDate: { type: Date, default: null },
  notes: { type: String },
}, { timestamps: true });

export default mongoose.model('Vehicle', vehicleSchema);
