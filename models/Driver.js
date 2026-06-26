import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phoneNumber: { type: String, required: true },
  licenseType: { type: String, trim: true },
  licenseExpiry: { type: Date },
  assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  status: { type: String, enum: ['Idle', 'Driving', 'Off Duty'], default: 'Idle' },
}, { timestamps: true });

export default mongoose.model('Driver', driverSchema);
