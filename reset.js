import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

async function run() {
    await mongoose.connect('mongodb://localhost:27017/garden_api');
    const hash = await bcrypt.hash('password123', 12);
    await User.updateMany({}, { $set: { password: hash } });
    console.log('All passwords reset to password123');
    process.exit(0);
}
run();
