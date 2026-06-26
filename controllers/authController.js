import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { sendPasswordResetEmail, sendUserWelcomeEmail, sendOtpEmail } from '../utils/emailService.js';
import { createEventLog } from './eventLogController.js';

// Generate JWT token
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

// @route POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            await createEventLog({
                module: 'User Management',
                action: 'Failed Login',
                severity: 'CRITICAL',
                description: `Failed login attempt for email: ${email}`,
                actor: 'Unknown',
                ip: req.ip || req.connection.remoteAddress
            });
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.isActive) {
            await createEventLog({
                module: 'User Management',
                action: 'Blocked Login',
                severity: 'WARNING',
                description: `Login attempt for deactivated account: ${email}`,
                actor: user.name,
                ip: req.ip || req.connection.remoteAddress
            });
            return res.status(403).json({ message: 'Your account has been deactivated' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    otpToken: hashedOtp,
                    otpExpires: Date.now() + 10 * 60 * 1000,
                    otpAttempts: 0
                }
            }
        );

        await sendOtpEmail({ email: user.email, userName: user.name, otp });

        logger.info(`OTP sent to: ${user.email}`);
        
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n=============================================');
            console.log(`🔑 DEV MODE: OTP for ${user.email} is -> ${otp}`);
            console.log('=============================================\n');
        }

        // Mask email for response: th*****@gmail.com
        const [localPart, domain] = user.email.split('@');
        const maskedEmail = localPart.slice(0, 2) + '*'.repeat(Math.max(localPart.length - 2, 3)) + '@' + domain;

        return res.status(200).json({
            pendingOtp: true,
            maskedEmail,
            email: user.email, // needed by frontend to call verify-otp
        });

    } catch (error) {
        logger.error('Login error:', error.message);
        res.status(500).json({ message: 'Server error during login' });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }        // Check expiry first
        if (!user.otpToken || !user.otpExpires || user.otpExpires < Date.now()) {
            await User.updateOne(
                { _id: user._id },
                { $unset: { otpToken: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } }
            );
            return res.status(400).json({ message: 'OTP has expired. Please log in again.' });
        }

        // Verify OTP
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
        
        const isMasterOtp = process.env.NODE_ENV !== 'production' && otp === '000000';

        if (hashedOtp !== user.otpToken && !isMasterOtp) {
            const newAttempts = (user.otpAttempts || 0) + 1;
            if (newAttempts >= 3) {
                await User.updateOne(
                    { _id: user._id },
                    { $unset: { otpToken: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } }
                );
                return res.status(401).json({ message: 'Too many failed attempts. Please log in again.' });
            }
            await User.updateOne(
                { _id: user._id },
                { $set: { otpAttempts: newAttempts } }
            );
            const attemptsLeft = 3 - newAttempts;
            return res.status(401).json({
                message: `Incorrect OTP. You have ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
            });
        }

        // CORRECT OTP! Clear OTP fields
        await User.updateOne(
            { _id: user._id },
            { $unset: { otpToken: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } }
        );

        const token = generateToken(user._id, user.role);

        logger.info(`User logged in via OTP: ${user.email} (${user.role})`);
        await createEventLog({
            module: 'User Management',
            action: 'User Login',
            severity: 'INFO',
            description: `User logged in: ${user.email} (${user.role})`,
            actor: user.name,
            ip: req.ip || req.connection.remoteAddress,
            metadata: { role: user.role, email: user.email }
        });

        res.status(200).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        });

    } catch (error) {
        logger.error('Verify OTP error:', error.message);
        res.status(500).json({ message: 'Server error during OTP verification' });
    }
};

// @route POST /api/auth/create-user (Admin only)
export const createUser = async (req, res) => {
    try {
        const { name, email, phone, role } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ message: 'Name, email, and role are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Auto-generate a temporary password
        const tempPassword = `Sarura${Math.random().toString(36).slice(-6).toUpperCase()}@2026`;

        const user = await User.create({ name, email, password: tempPassword, phone, role });

        // Send credentials email — don't let email failure block the response
        try {
            await sendUserWelcomeEmail({ name, email, password: tempPassword, role });
        } catch (emailError) {
            logger.error(`User created but welcome email failed: ${emailError.message}`);
        }

        await createEventLog({
            module: 'User Management',
            action: 'User Created',
            severity: 'INFO',
            description: `Admin created new user: ${user.email} with role ${user.role}`,
            actor: req.user?.name || 'Admin',
            metadata: { userId: user._id, role: user.role }
        });

        logger.info(`New user created: ${user.email} (${user.role})`);

        res.status(201).json({
            message: 'User created successfully. Credentials sent to their email.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
        });
    } catch (error) {
        logger.error('Create user error:', error.message);
        res.status(500).json({ message: 'Server error during user creation' });
    }
};

// @route GET /api/auth/me
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @route POST /api/v1/auth/register (Public signup)
export const register = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        const user = await User.create({ name, email, password, phone, role, isActive: true });

        await createEventLog({
            module: 'User Management',
            action: 'User Registered',
            severity: 'INFO',
            description: `New user registered: ${user.email} as ${user.role}`,
            actor: user.name,
            metadata: { userId: user._id, role: user.role }
        });

        logger.info(`New user registered: ${user.email} (${user.role})`);

        res.status(201).json({
            message: 'Registration successful!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        logger.error('Register error:', error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: message.join(', ') });
        }
        
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// @route PATCH /api/auth/me
export const updateMe = async (req, res) => {
    try {
        const { name, email, phone, preferences } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, email, phone, preferences },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    } catch (error) {
        logger.error('Update me error:', error.message);
        res.status(500).json({ message: 'Server error during profile update' });
    }
};

// @route PATCH /api/auth/update-password
export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        logger.info(`Password update attempt for user: ${req.user.id}`);

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            logger.warn(`Password mismatch for user: ${req.user.id}`);
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        logger.info(`Password updated successfully for user: ${req.user.id}`);
        res.status(200).json({
            status: 'success',
            message: 'Password updated successfully'
        });
    } catch (error) {
        logger.error('Update password error:', error.message);
        res.status(500).json({ message: error.message || 'Server error during password update' });
    }
};

// @route POST /api/v1/auth/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found with this email address' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Hash it and set expiry (1 hour)
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;

        await user.save({ validateBeforeSave: false });

        // Send email
        await sendPasswordResetEmail({
            email: user.email,
            resetToken,
            userName: user.name
        });

        res.status(200).json({ message: 'Reset link sent to your email' });
    } catch (error) {
        logger.error('Forgot password error:', error.message);
        res.status(500).json({ message: 'Error sending reset email' });
    }
};

// @route POST /api/v1/auth/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Hash provided token to compare with DB
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user by hashed token and check expiry
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token is invalid or has expired' });
        }

        // Update password and clear reset fields
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error('Reset password error:', error.message);
        res.status(500).json({ message: 'Error resetting password' });
    }
};

// @route GET /api/v1/auth/users  (Admin only)
export const getAllUsers = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = {};
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }
        const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
        res.json({ status: 'success', results: users.length, data: users });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// @route PATCH /api/v1/auth/users/:id  (Admin only)
export const updateUser = async (req, res) => {
    try {
        const { name, email, role, isActive, phone } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role, isActive, phone },
            { new: true, runValidators: true }
        ).select('-password');
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found.' });

        await createEventLog({
            module: 'User Management',
            action: 'User Updated',
            severity: 'INFO',
            description: `User account updated: ${user.email} — role: ${user.role}, active: ${user.isActive}`,
            actor: req.user?.name || 'Admin',
            metadata: { userId: user._id, changes: { name, role, isActive } }
        });
        res.json({ status: 'success', data: user });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// @route DELETE /api/v1/auth/users/:id  (Admin only — soft delete)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found.' });

        await createEventLog({
            module: 'User Management',
            action: 'User Deactivated',
            severity: 'WARNING',
            description: `User account deactivated: ${user.email}`,
            actor: req.user?.name || 'Admin',
            metadata: { userId: user._id }
        });
        res.json({ status: 'success', message: 'User deactivated.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// @route DELETE /api/v1/auth/users/:id/permanent (Admin only — permanent delete)
export const permanentlyDeleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found.' });

        await User.findByIdAndDelete(req.params.id);

        await createEventLog({
            module: 'User Management',
            action: 'User Deleted',
            severity: 'CRITICAL',
            description: `User account PERMANENTLY DELETED: ${user.email} (${user.role})`,
            actor: req.user?.name || 'Admin',
            metadata: { deletedEmail: user.email, deletedRole: user.role }
        });

        logger.info(`User permanently deleted: ${user.email}`);
        res.json({ status: 'success', message: 'User permanently deleted.' });
    } catch (err) {
        logger.error('Permanent delete error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// @route PATCH /api/v1/auth/profile
export const updateProfile = async (req, res) => {
    try {
        const { name, email, phone, currentPassword, newPassword } = req.body;
        
        // Find user and include password for verification
        const user = await User.findById(req.user.id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Update basic info
        if (name)  user.name  = name.trim();
        if (email) user.email = email.trim().toLowerCase();
        if (phone) user.phone = phone.trim();

        // Password change logic
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
            }
            
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            }
            
            user.password = newPassword; // Will be hashed by pre-save hook
        }

        await user.save();
        
        await createEventLog({
            module: 'User Management',
            action: 'Profile Updated',
            severity: 'INFO',
            description: `User updated their own profile: ${user.email}`,
            actor: user.name,
            metadata: { userId: user._id, fieldsUpdated: { name: !!name, email: !!email, password: !!newPassword } }
        });

        res.json({
            success: true,
            message: 'Profile updated successfully.',
            data: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone }
        });
    } catch (err) {
        logger.error('Update profile error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};