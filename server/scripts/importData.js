// Rebuilds the resorts, trails and lifts collections from the merged OSM data file.
// Usage: npm run import [-- path/to/ski-resorts-with-members.json]
//
// Everything is written to *_import staging collections first and only swapped in once all
// of it has loaded, so a run that fails while loading leaves the live data untouched. The
// three swaps can't be atomic together: each is retried, and if one still fails the script
// says which collections are new. Running it again rebuilds all three.
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');
const { deriveResortFields } = require('../utils/resortFields');

const DATA_FILE = process.argv[2] || path.join(__dirname, '../db/ski-resorts-with-members.json');
const BATCH_SIZE = 1000;
const MODELS = [Resort, Trail, Lift];
const SWAP_ATTEMPTS = 3;

const stagingName = (Model) => `${Model.collection.collectionName}_import`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toNumber = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : null;
};

// Full way geometry for the map, plus its average point for legacy single-point fields
const toCoordinates = (member) => {
  const coordinates = (member.geometry || [])
    .map((point) => ({ longitude: toNumber(point.lon), latitude: toNumber(point.lat) }))
    .filter((point) => point.longitude !== null && point.latitude !== null);

  if (coordinates.length === 0) {
    return { coordinates, longitude: toNumber(member.center?.lon), latitude: toNumber(member.center?.lat) };
  }

  return {
    coordinates,
    longitude: coordinates.reduce((sum, point) => sum + point.longitude, 0) / coordinates.length,
    latitude: coordinates.reduce((sum, point) => sum + point.latitude, 0) / coordinates.length
  };
};

// OSM ways become lifts (aerialway) or trails (piste); nodes and stations are skipped.
// OSM rarely records whether a run is open, so a missing status stays 'unknown'.
const toMember = (member, resortId) => {
  if (member.type !== 'way') return null;

  const tags = member.tags || {};
  const shared = { description: tags.description || '', resort: resortId, ...toCoordinates(member) };

  if (tags.aerialway && tags.aerialway !== 'station') {
    return {
      Model: Lift,
      data: {
        ...shared,
        name: tags.name || `Lift ${member.id}`,
        aerialway: tags.aerialway,
        capacity: toNumber(tags['aerialway:capacity']),
        duration: toNumber(tags['aerialway:duration']),
        status: tags.operational_status || tags['aerialway:status'] || 'unknown',
        oneway: tags.oneway === 'yes',
        lit: tags.lit === 'yes',
        length: toNumber(tags['aerialway:length'])
      }
    };
  }

  if (tags['piste:type'] || tags.piste) {
    return {
      Model: Trail,
      data: {
        ...shared,
        name: tags.name || `Trail ${member.id}`,
        pisteType: tags['piste:type'] || tags.piste,
        difficulty: tags['piste:difficulty'] || 'unknown',
        grooming: tags['piste:grooming'] || 'unknown',
        status: tags['piste:status'] || 'unknown',
        lit: tags['piste:lit'] === 'yes',
        oneway: tags['piste:oneway'] === 'yes',
        abandoned: tags['piste:abandoned'] === 'yes',
        gladed: tags.gladed === 'yes',
        patrolled: tags.patrolled !== 'no',
        groomingPriority: toNumber(tags['piste:grooming:priority'])
      }
    };
  }

  return null;
};

// Cast and validate through the Mongoose model so staged documents match the schema
const toDocument = (Model, data) => {
  const doc = new Model(data);
  const error = doc.validateSync();
  if (error) throw error;
  return doc.toObject();
};

const buildDocuments = (resortsData) => {
  const docs = new Map(MODELS.map((Model) => [Model, []]));
  let skipped = 0;

  for (const resortData of resortsData) {
    const resortId = new mongoose.Types.ObjectId();
    const members = [];

    for (const member of resortData.members || []) {
      const mapped = toMember(member, resortId);
      if (!mapped) continue;
      try {
        const doc = toDocument(mapped.Model, mapped.data);
        docs.get(mapped.Model).push(doc);
        members.push({ refId: doc._id, refType: mapped.Model === Lift ? 'lift' : 'trail' });
      } catch (error) {
        skipped++;
        console.warn(`Skipping member ${member.id} of ${resortData.name}: ${error.message}`);
      }
    }

    docs.get(Resort).push(toDocument(Resort, {
      _id: resortId,
      rank: parseInt(String(resortData.rank).replace(/,/g, ''), 10) || null,
      name: resortData.name,
      rating: resortData.rating,
      url: resortData.url,
      location_coordinate: resortData.location_coordinate,
      location_country: resortData.location_country,
      location_region: resortData.location_region,
      elevation_top_m: resortData.elevation_top_m,
      elevation_difference_m: resortData.elevation_difference_m,
      total_slope_length_km: resortData.total_slope_length_km,
      number_of_lifts: resortData.number_of_lifts,
      number_of_slopes: resortData.number_of_slopes,
      annual_snowfall_cm: resortData.annual_snowfall_cm,
      number_of_matches: resortData.number_of_matches,
      members,
      ...deriveResortFields(resortData)
    }));
  }

  return { docs, skipped };
};

const dropStaging = async (db) => {
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const Model of MODELS) {
    if (existing.has(stagingName(Model))) {
      await db.collection(stagingName(Model)).drop();
    }
  }
};

const stagingExists = async (db, Model) => (
  await db.listCollections({ name: stagingName(Model) }, { nameOnly: true }).toArray()
).length > 0;

// The swap stopped part-way: the live collections may be a mix of old and new data
class PartialSwapError extends Error {
  constructor(cause, swapped) {
    super(cause.message, { cause });
    this.name = 'PartialSwapError';
    this.swapped = swapped;
  }
}

// One rename, retried through brief outages such as a primary stepping down. A rename whose
// reply was lost has already happened, which shows as its staging collection being gone.
const swapOne = async (db, Model, { attempts, wait }) => {
  for (let attempt = 1; ; attempt++) {
    try {
      if (attempt > 1 && !(await stagingExists(db, Model))) return;
      await db.collection(stagingName(Model)).rename(Model.collection.collectionName, { dropTarget: true });
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await wait(1000 * attempt);
    }
  }
};

// MongoDB can't rename inside a transaction, so the three swaps aren't atomic together, and
// stopping part-way leaves new resorts beside old trails or lifts that point at resort ids no
// longer there. An error after the first swap is a PartialSwapError naming what is live.
const swapIn = async (db, { attempts = SWAP_ATTEMPTS, wait = sleep } = {}) => {
  const swapped = [];
  for (const Model of MODELS) {
    try {
      await swapOne(db, Model, { attempts, wait });
    } catch (error) {
      // The live data is untouched only if the first staging collection is still there
      if (swapped.length === 0 && await stagingExists(db, Model).catch(() => false)) throw error;
      throw new PartialSwapError(error, swapped);
    }
    swapped.push(Model.collection.collectionName);
  }
};

// Stages every collection, then swaps them in. The staging collections are dropped on a
// failure that left the live data untouched, and kept after a partial swap; the next run
// drops them before it starts.
const runImport = async (db, docs, swapOptions) => {
  try {
    // Leftovers from an earlier failed run
    await dropStaging(db);

    for (const Model of MODELS) {
      const staging = db.collection(stagingName(Model));
      const modelDocs = docs.get(Model);
      for (let i = 0; i < modelDocs.length; i += BATCH_SIZE) {
        await staging.insertMany(modelDocs.slice(i, i + BATCH_SIZE), { ordered: true });
      }
      for (const [fields, options] of Model.schema.indexes()) {
        await staging.createIndex(fields, options);
      }
      console.log(`Staged ${modelDocs.length} ${Model.collection.collectionName}`);
    }

    await swapIn(db, swapOptions);
  } catch (error) {
    if (!(error instanceof PartialSwapError)) await dropStaging(db).catch(() => {});
    throw error;
  }
};

const importData = async () => {
  const resortsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Read ${resortsData.length} resorts from ${DATA_FILE}`);

  const { docs, skipped } = buildDocuments(resortsData);

  await connectDB();
  await runImport(mongoose.connection.db, docs);

  console.log('\n=== Import Summary ===');
  for (const Model of MODELS) {
    console.log(`${Model.collection.collectionName}: ${await Model.countDocuments()}`);
  }
  if (skipped > 0) console.log(`Skipped ${skipped} invalid members`);
};

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

  importData()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      if (error instanceof PartialSwapError) {
        console.error('Import failed while swapping in the new data:', error.message);
        console.error(`Swapped in: ${error.swapped.join(', ') || 'none for certain'}. The others may still hold the old data, `
          + 'so resort pages can show no trails or lifts. Run npm run import again to rebuild all three.');
      } else {
        console.error('Import failed, live data left unchanged:', error.message);
      }
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { buildDocuments, runImport, swapIn, PartialSwapError };
