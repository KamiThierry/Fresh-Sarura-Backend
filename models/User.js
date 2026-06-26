import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false, // never return password in queries
    },
    phone: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['admin', 'production_manager', 'farm_manager', 'buyer', 'logistic_officer', 'quality_officer'],
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    preferences: {
        language: { type: String, default: 'English' },
        darkMode: { type: Boolean, default: false },
        dataSaver: { type: Boolean, default: false },
        notifications: {
            taskReminders: { type: Boolean, default: true },
            weatherAlerts: { type: Boolean, default: true },
            budgetApprovals: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        }
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    otpToken: String,
    otpExpires: Date,
    otpAttempts: { type: Number, default: 0 },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;