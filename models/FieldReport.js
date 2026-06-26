import mongoose from 'mongoose';

const fieldReportSchema = new mongoose.Schema(
  {
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CropCycle', required: true },
    budgetRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetRequest' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByName: { type: String },
    description: { type: String, required: true },
    category: { type: String },
    block: { type: String },
    approvedAmountRwf: { type: Number },
    actualCostRwf: { type: Number, required: true },
    notes: { type: String },
    hasProof: { type: Boolean, default: false },
    proofUrl: { type: String },
    status: {
      type: String,
      enum: ['Submitted', 'Flagged', 'Cleared'],
      default: 'Submitted',
    },
    isReadByPM: { type: Boolean, default: false },
    pmFlag: { type: String },
  },
  { timestamps: true }
);

const FieldReport = mongoose.model('FieldReport', fieldReportSchema);
export default FieldReport;
