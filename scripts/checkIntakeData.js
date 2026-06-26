import mongoose from 'mongoose';
import IntakeLog from '../models/IntakeLog.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await IntakeLog.countDocuments();
    console.log('Total IntakeLogs:', count);
    const logs = await IntakeLog.find();
    console.log('--- Logs ---');
    logs.forEach(l => console.log(`ID: ${l._id}, TruckId: ${l.truckId}, Type: ${typeof l.truckId}`));
    await mongoose.disconnect();
}

checkData();
