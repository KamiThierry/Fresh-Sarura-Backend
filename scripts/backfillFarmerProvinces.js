/**
 * backfillFarmerProvinces.js
 * ---------------------------
 * One-time migration: sets the `province` field on every existing Farmer
 * document based on their stored `district` value.
 *
 * Usage:
 *   cd backend
 *   node scripts/backfillFarmerProvinces.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Farmer from '../models/Farmer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

// Complete district → province mapping (matches rwandaLocations.ts IDs)
const DISTRICT_TO_PROVINCE = {
    // Kigali City
    gasabo:     'kigali',
    kicukiro:   'kigali',
    nyarugenge: 'kigali',

    // Eastern Province
    bugesera:   'eastern',
    gatsibo:    'eastern',
    kayonza:    'eastern',
    kirehe:     'eastern',
    ngoma:      'eastern',
    nyagatare:  'eastern',
    rwamagana:  'eastern',

    // Northern Province
    burera:     'northern',
    gakenke:    'northern',
    gicumbi:    'northern',
    musanze:    'northern',
    rulindo:    'northern',

    // Southern Province
    gisagara:   'southern',
    huye:       'southern',
    kamonyi:    'southern',
    muhanga:    'southern',
    nyamagabe:  'southern',
    nyanza:     'southern',
    nyaruguru:  'southern',
    ruhango:    'southern',

    // Western Province
    karongi:    'western',
    ngororero:  'western',
    nyabihu:    'western',
    nyamasheke: 'western',
    rubavu:     'western',
    rusizi:     'western',
    rutsiro:    'western',
};

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  Connected to MongoDB');

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const [districtId, provinceId] of Object.entries(DISTRICT_TO_PROVINCE)) {
        const result = await Farmer.updateMany(
            // Only update docs that have this district but no province yet
            { district: districtId, province: { $in: [null, '', undefined] } },
            { $set: { province: provinceId } }
        );

        if (result.modifiedCount > 0) {
            console.log(`  ↳ ${districtId.padEnd(12)} → ${provinceId.padEnd(10)}  (${result.modifiedCount} updated)`);
            totalUpdated += result.modifiedCount;
        } else {
            totalSkipped++;
        }
    }

    console.log(`\n🎉  Backfill complete — ${totalUpdated} farmer(s) updated, ${totalSkipped} district(s) had no changes.`);
    await mongoose.disconnect();
    process.exit(0);
};

run().catch(err => {
    console.error('❌  Backfill failed:', err.message);
    process.exit(1);
});
