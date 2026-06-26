import mongoose from 'mongoose';
import User from './models/User.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fresh-sarura');
        console.log('Connected to MongoDB');

        const email = 'test-reset-' + Date.now() + '@example.com';
        const user = await User.create({
            name: 'Test Reset User',
            email,
            password: 'oldpassword123',
            role: 'production_manager'
        });
        console.log('Created test user:', email);

        // Simulate Forgot Password
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save({ validateBeforeSave: false });
        console.log('Reset token generated and saved');

        // Simulate Reset Password
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const userToReset = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (userToReset) {
            userToReset.password = 'newpassword123';
            userToReset.passwordResetToken = undefined;
            userToReset.passwordResetExpires = undefined;
            await userToReset.save();
            console.log('Password reset successfully in DB!');
        } else {
            console.error('User not found or token expired');
        }

        // Cleanup
        await User.deleteOne({ _id: user._id });
        console.log('Cleanup successful');

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
