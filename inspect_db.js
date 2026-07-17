import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const PackagingStockSchema = new mongoose.Schema({}, { strict: false });
const PackagingStock = mongoose.model('PackagingStock', PackagingStockSchema, 'packagingstocks');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const docs = await PackagingStock.find({}).lean();
    console.log(JSON.stringify(docs, null, 2));
    await mongoose.disconnect();
}

main().catch(console.error);
