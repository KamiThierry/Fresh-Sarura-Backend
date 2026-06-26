import CropVariety from '../models/CropVariety.js';

// GET /crop-varieties — all active, for dropdowns
export const getCropVarieties = async (req, res) => {
    try {
        const varieties = await CropVariety.find({ isActive: true }).sort({ name: 1 });
        res.json({ success: true, data: varieties });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /crop-varieties/all — admin only, includes inactive
export const getAllCropVarieties = async (req, res) => {
    try {
        const varieties = await CropVariety.find().sort({ name: 1 });
        res.json({ success: true, data: varieties });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /crop-varieties
export const createCropVariety = async (req, res) => {
    try {
        const { name, category, seasons, grades } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Crop name is required.' });

        const existing = await CropVariety.findOne({ name: name.trim(), isActive: true });
        if (existing) return res.status(400).json({ success: false, message: 'A crop with this name already exists.' });

        const variety = await CropVariety.create({
            name: name.trim(),
            category: category || 'Vegetables',
            seasons: seasons || [],
            grades: grades || ['Grade A (Export)', 'Grade B (Local)'],
            createdBy: req.user._id,
        });
        res.status(201).json({ success: true, data: variety });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /crop-varieties/:id
export const updateCropVariety = async (req, res) => {
    try {
        const { name, category, seasons, grades, isActive } = req.body;
        const variety = await CropVariety.findByIdAndUpdate(
            req.params.id,
            { name, category, seasons, grades, isActive },
            { new: true, runValidators: true }
        );
        if (!variety) return res.status(404).json({ success: false, message: 'Crop variety not found.' });
        res.json({ success: true, data: variety });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /crop-varieties/:id — soft delete
export const deleteCropVariety = async (req, res) => {
    try {
        const variety = await CropVariety.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!variety) return res.status(404).json({ success: false, message: 'Crop variety not found.' });
        res.json({ success: true, message: 'Crop variety deactivated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
