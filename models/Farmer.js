import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({
    full_name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    farm_name: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    national_id: {
        type: String,
        required: [true, 'National ID is required'],
        unique: true,
        trim: true,
    },
    province: {
        type: String,
    },
    district: {
        type: String,
        required: [true, 'District is required'],
    },
    sector: {
        type: String,
        required: [true, 'Sector is required'],
    },
    cell: {
        type: String,
        required: [true, 'Cell is required'],
    },
    village: {
        type: String,
        required: [true, 'Village is required'],
    },
    produce_types: {
        type: [String],
        required: [true, 'At least one produce type is required'],
    },
    farm_size_hectares: {
        type: Number,
        required: [true, 'Farm size is required'],
    },
    production_capacity_tons: {
        type: Number,
        required: [true, 'Production capacity is required'],
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Auditing'],
        default: 'Active',
    },
    registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

const Farmer = mongoose.model('Farmer', farmerSchema);
export default Farmer;