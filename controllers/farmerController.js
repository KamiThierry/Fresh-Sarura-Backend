import Farmer from '../models/Farmer.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import { sendFarmerWelcomeEmail } from '../utils/emailService.js';
import { createEventLog } from './eventLogController.js';

// @route GET /api/v1/farmers
export const getFarmers = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = {};
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }
        const farmers = await Farmer.find(filter).sort({ createdAt: -1 });
        res.status(200).json({ farmers });
    } catch (error) {
        logger.error('Get farmers error:', error.message);
        res.status(500).json({ message: 'Server error fetching farmers' });
    }
};

// @route POST /api/v1/farmers
export const registerFarmer = async (req, res) => {
    let farmerUser;
    let newlyCreatedUser = false;
    try {
        const {
            full_name, farm_name, national_id, province, district, sector, cell, village,
            produce_types, farm_size_hectares, production_capacity_tons, phone, email
        } = req.body;

        if (!full_name || !district || !sector || !cell || !village || !national_id || !phone || !farm_size_hectares || !email) {
            return res.status(400).json({ message: 'Please fill all required fields' });
        }

        // 1. Check if Farmer already exists with this email
        const existingFarmer = await Farmer.findOne({ email });
        if (existingFarmer) {
            return res.status(400).json({ message: 'A farmer with this email is already registered' });
        }

        // 2. Check if User already exists
        farmerUser = await User.findOne({ email });
        
        // Generate temporary password (used if creating new or if user needs it sent again)
        const tempPassword = `Farm${Math.random().toString(36).slice(-6).toUpperCase()}@2026`;

        if (!farmerUser) {
            // Create farmer User account if not exists
            farmerUser = await User.create({
                name: full_name,
                email,
                password: tempPassword,
                phone,
                role: 'farm_manager',
                isActive: true,
            });
            newlyCreatedUser = true;
        } else {
            // Update existing user's password to match the one we're emailing
            farmerUser.password = tempPassword;
            await farmerUser.save();
            logger.info(`Updated password for existing user and linking to new farmer: ${email}`);
        }

        // 3. Create farmer record
        try {
            const farmer = await Farmer.create({
                full_name,
                farm_name,
                national_id,
                province,
                district,
                sector,
                cell,
                village,
                produce_types,
                farm_size_hectares,
                production_capacity_tons,
                phone,
                email,
                userId: farmerUser._id,
                registeredBy: req.user._id,
            });

            // 4. Send welcome email - try/catch to prevent email failure from rolling back registration
            try {
                await sendFarmerWelcomeEmail({
                    farmerName: full_name,
                    email,
                    password: tempPassword,
                });
            } catch (emailError) {
                logger.error(`Farmer registered but welcome email failed: ${emailError.message}`);
            }

            logger.info(`Farmer registered: ${farmer.full_name} by ${req.user.email}`);

            res.status(201).json({
                message: 'Farmer registered successfully!',
                farmer,
            });

            await createEventLog({
                module: 'Farmer Management',
                action: 'Farmer Registered',
                severity: 'INFO',
                description: `New farmer registered: ${full_name} from ${district}, ${province}`,
                actor: req.user.name,
                metadata: {
                    farmerId: farmer._id,
                    farmerName: full_name,
                    district,
                    province,
                    produce: produce_types,
                    farmSize: farm_size_hectares
                }
            });
        } catch (farmerError) {
            // ROLLBACK: If farmer creation fails and we JUST created the user in this request, delete the user
            if (newlyCreatedUser && farmerUser) {
                await User.findByIdAndDelete(farmerUser._id);
                logger.warn(`Rollback: Deleted orphaned user ${email} due to farmer registration failure`);
            }
            throw farmerError;
        }
    } catch (error) {
        logger.error('Register farmer error:', error.message);
        res.status(500).json({ message: error.message || 'Server error registering farmer' });
    }
};

// @route PATCH /api/v1/farmers/:id
export const updateFarmer = async (req, res) => {
    try {
        // Strip immutable fields from the request body
        const { national_id, userId, registeredBy, _id, ...updateFields } = req.body;

        const farmer = await Farmer.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        // Keep the linked User name and phone in sync
        if (farmer.userId && (updateFields.full_name || updateFields.phone)) {
            const userUpdate = {};
            if (updateFields.full_name) userUpdate.name  = updateFields.full_name;
            if (updateFields.phone)     userUpdate.phone = updateFields.phone;
            await User.findByIdAndUpdate(farmer.userId, { $set: userUpdate });
        }

        logger.info(`Farmer updated: ${farmer.full_name} by ${req.user.email}`);
        res.status(200).json({ message: 'Farmer updated successfully', farmer });

        await createEventLog({
            module: 'Farmer Management',
            action: 'Farmer Updated',
            severity: 'INFO',
            description: `Farmer record updated: ${farmer.full_name}`,
            actor: req.user.name,
            metadata: { farmerId: farmer._id, changes: updateFields }
        });
    } catch (error) {
        logger.error('Update farmer error:', error.message);
        res.status(500).json({ message: error.message || 'Server error updating farmer' });
    }
};

// @route DELETE /api/v1/farmers/:id
export const deleteFarmer = async (req, res) => {
    try {
        logger.info(`Received request to delete farmer with ID: ${req.params.id}`);
        const farmer = await Farmer.findByIdAndDelete(req.params.id);
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        // Cascade: also delete the linked User account (if any)
        if (farmer.userId) {
            await User.findByIdAndDelete(farmer.userId);
            logger.info(`Cascade-deleted user account for farmer: ${farmer.full_name}`);
        }

        logger.info(`Farmer permanently deleted: ${farmer.full_name} by ${req.user.email}`);
        res.status(200).json({ message: 'Farmer and linked account deleted successfully' });

        await createEventLog({
            module: 'Farmer Management',
            action: 'Farmer Deleted',
            severity: 'WARNING',
            description: `Farmer permanently deleted: ${farmer.full_name}`,
            actor: req.user.name,
            metadata: { farmerName: farmer.full_name }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting farmer' });
    }
};

// @route PATCH /api/v1/farmers/:id/suspend
export const suspendFarmer = async (req, res) => {
    try {
        const farmer = await Farmer.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'Inactive' } },
            { new: true }
        );
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        // Also deactivate linked user account
        if (farmer.userId) {
            await User.findByIdAndUpdate(farmer.userId, { $set: { isActive: false } });
        }

        logger.info(`Farmer suspended: ${farmer.full_name} by ${req.user.email}`);
        res.status(200).json({ message: 'Farmer account suspended', farmer });

        await createEventLog({
            module: 'Farmer Management',
            action: 'Farmer Suspended',
            severity: 'WARNING',
            description: `Farmer account suspended: ${farmer.full_name}`,
            actor: req.user.name,
            metadata: { farmerId: farmer._id, farmerName: farmer.full_name }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error suspending farmer' });
    }
};

// @route PATCH /api/v1/farmers/:id/reactivate
export const reactivateFarmer = async (req, res) => {
    try {
        const farmer = await Farmer.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'Active' } },
            { new: true }
        );
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        // Re-enable linked user account
        if (farmer.userId) {
            await User.findByIdAndUpdate(farmer.userId, { $set: { isActive: true } });
        }

        logger.info(`Farmer reactivated: ${farmer.full_name} by ${req.user.email}`);
        res.status(200).json({ message: 'Farmer account reactivated', farmer });

        await createEventLog({
            module: 'Farmer Management',
            action: 'Farmer Reactivated',
            severity: 'INFO',
            description: `Farmer account reactivated: ${farmer.full_name}`,
            actor: req.user.name,
            metadata: { farmerId: farmer._id, farmerName: farmer.full_name }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error reactivating farmer' });
    }
};