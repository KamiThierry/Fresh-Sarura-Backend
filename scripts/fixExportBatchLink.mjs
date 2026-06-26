import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB');

const ExportBatch = mongoose.model(
    'ExportBatch',
    new mongoose.Schema({}, { strict: false }),
    'exportbatches'
);

const result = await ExportBatch.updateOne(
    { batchId: 'EB-JMOHGW' },
    { $set: { processingBatchId: new mongoose.Types.ObjectId('69e89bb49adbcc957b29198b') } }
);

if (result.matchedCount === 0) {
    console.log('ERROR: EB-JMOHGW not found in the database.');
} else if (result.modifiedCount === 0) {
    console.log('EB-JMOHGW was found but no change was needed (already correct?).');
} else {
    console.log('Fixed: EB-JMOHGW → processingBatchId now points to 69e89bb49adbcc957b29198b');
}

await mongoose.disconnect();
console.log('Done.');
