import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
  activityName: { type: String, required: true },
  category: { type: String, required: true, enum: ['Seeds & Seedlings', 'Fertilizers', 'Chemicals', 'Labor'] },
  estimatedCostRwf: { type: Number, required: true },
});

const budgetRequestSchema = new mongoose.Schema(
  {
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    cycleName: { type: String },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByName: { type: String },          // denormalized display name
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    lineItems: [lineItemSchema],
    totalRequestedRwf: { type: Number, required: true },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    isReadByPM: { type: Boolean, default: false },
    pmNote: { type: String },
  },
  { timestamps: true }
);

const BudgetRequest = mongoose.model('BudgetRequest', budgetRequestSchema);
export default BudgetRequest;
