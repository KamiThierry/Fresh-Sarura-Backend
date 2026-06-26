import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB');

const ProcessingBatch = mongoose.model(
    'ProcessingBatch',
    new mongoose.Schema({}, { strict: false }),
    'processingbatches'
);

const batches = await ProcessingBatch.find({
    status: 'Done',
    stockId: { $exists: false }
});

console.log(`Found ${batches.length} Done batch(es) without a stockId`);

for (const batch of batches) {
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const stockId = `STK-${suffix}`;
    await ProcessingBatch.updateOne({ _id: batch._id }, { $set: { stockId } });
    console.log(`  Patched ${batch._id}  →  ${stockId}`);
}

await mongoose.disconnect();
console.log('Done — all patches applied.');
