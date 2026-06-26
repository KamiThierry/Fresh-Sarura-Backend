import mongoose from 'mongoose';

const cropCycleSchema = new mongoose.Schema({
    cycleId: { type: String, unique: true },
    farm_name: { type: String },
    crop_name: { type: String, required: true },
    season: { type: String, required: true },
    farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    field_size_hectares: { type: Number, required: true },
    planting_date: { type: Date, required: true },
    expected_harvest_date: { type: Date, required: true },
    block_name: { type: String, required: true },
    block_size_hectares: { type: Number, required: true },
    total_budget: { type: Number, required: true },
    budget_seeds: { type: Number, required: true },
    budget_fertilizers: { type: Number, required: true },
    budget_chemicals: { type: Number, required: true },
    budget_labor: { type: Number, required: true },
    yield_goal_kg: { type: Number, required: true },
    expected_price_per_kg: { type: Number, required: true },
    budget_categories: [
        {
            name: { type: String },
            allocated: { type: Number, default: 0 },
            approved: { type: Number, default: 0 },
            spent: { type: Number, default: 0 },
        }
    ],
    approved: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'in_progress', 'completed', 'cancelled'], default: 'active' },
    final_yield: { type: Number, default: null },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

cropCycleSchema.pre('save', async function (next) {
    if (!this.cycleId) {
        const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.cycleId = `CC-${uniqueSuffix}`;
    }

    // Backend validation: planting date not in past + 8PM cutoff
    const now = new Date();
    if (this.planting_date) {
        const plantingDate = new Date(this.planting_date);
        const todayStart = new Date().setHours(0,0,0,0);
        
        if (plantingDate < todayStart) {
            return next(new Error('Planting date cannot be in the past.'));
        }

        const isToday = plantingDate.getFullYear() === now.getFullYear() &&
                        plantingDate.getMonth() === now.getMonth() &&
                        plantingDate.getDate() === now.getDate();
        
        if (isToday && now.getHours() >= 20) {
            return next(new Error('It is past 8 PM; please schedule the planting for tomorrow.'));
        }
    }

    // Backend validation: harvest must be after planting
    if (this.planting_date && this.expected_harvest_date) {
        if (this.expected_harvest_date <= this.planting_date) {
            return next(new Error('Expected harvest date must be after planting date.'));
        }
    }

    // Backend validation: block cannot exceed field
    if (this.block_size_hectares > this.field_size_hectares) {
        return next(new Error('Block size cannot exceed total field size.'));
    }

    if (this.isNew && (!this.budget_categories || this.budget_categories.length === 0)) {
        this.budget_categories = [
            { name: 'Seeds & Seedlings', allocated: this.budget_seeds || 0, spent: 0 },
            { name: 'Fertilizers', allocated: this.budget_fertilizers || 0, spent: 0 },
            { name: 'Chemicals', allocated: this.budget_chemicals || 0, spent: 0 },
            { name: 'Labor', allocated: this.budget_labor || 0, spent: 0 },
        ];
    }

    next();
});

const CropCycle = mongoose.model('CropCycle', cropCycleSchema);
export default CropCycle;
