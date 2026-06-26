import mongoose from 'mongoose';
import User from '../models/User.js';
import Farmer from '../models/Farmer.js';
import CropCycle from '../models/CropCycle.js';
import HarvestDeclaration from '../models/HarvestDeclaration.js';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

async function checkHarvests() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const harvests = await HarvestDeclaration.find({}).populate('declaredBy', 'name');
        console.log(`Total harvest declarations in database: ${harvests.length}`);
        harvests.forEach(h => {
            console.log(`- Harvest: Crop=${h.cropName}, EstWeight=${h.estimatedWeightKg}, Status=${h.status}, DeclaredBy=${h.declaredBy?.name || 'N/A'}, CycleId=${h.cycleId}`);
        });

    } catch (err) {
        console.error('Failed to query harvests:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

checkHarvests();
