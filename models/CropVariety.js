import mongoose from 'mongoose';

const cropVarietySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        enum: ['Vegetables', 'Fruits', 'Herbs', 'Other'],
        default: 'Vegetables',
    },
    seasons: {
        type: [String],
        default: [],
    },
    grades: {
        type: [String],
        default: ['Grade A (Export)', 'Grade B (Local)'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

const CropVariety = mongoose.model('CropVariety', cropVarietySchema);
export default CropVariety;
