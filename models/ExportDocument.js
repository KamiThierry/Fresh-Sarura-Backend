import mongoose from 'mongoose';

const exportDocumentSchema = new mongoose.Schema({
    shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    docType:    { type: String, enum: ['PackingList', 'CommercialInvoice', 'PhytosanitaryCert', 'AWB', 'Other'], required: true },
    fileName:   { type: String, required: true },
    fileUrl:    { type: String, required: true },  // base64 string — same as proofUrl in FieldReport
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:     { type: String, enum: ['Pending', 'Uploaded', 'Verified'], default: 'Uploaded' },
}, { timestamps: true });

export default mongoose.model('ExportDocument', exportDocumentSchema);
