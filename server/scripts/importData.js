// Rebuilds the resorts, trails and lifts collections from the merged OSM data file.
// Usage: npm run import [-- path/to/ski-resorts-with-members.json]
//
// Everything is written to *_import staging collections first and only swapped in
// once the whole import has succeeded, so a failed run leaves the live data untouched.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');

const DATA_FILE = process.argv[2] || path.join(__dirname, '../db/ski-resorts-with-members.json');
const BATCH_SIZE = 1000;
const MODELS = [Resort, Trail, Lift];

const stagingName = (Model) => `${Model.collection.collectionName}_import`;

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
      members
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

const importData = async () => {
  const resortsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`Read ${resortsData.length} resorts from ${DATA_FILE}`);

  const { docs, skipped } = buildDocuments(resortsData);

  await connectDB();
  const { db } = mongoose.connection;

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

    // Each rename is atomic; the live collections are replaced only after every batch landed
    for (const Model of MODELS) {
      await db.collection(stagingName(Model)).rename(Model.collection.collectionName, { dropTarget: true });
    }
  } catch (error) {
    await dropStaging(db).catch(() => {});
    throw error;
  }

  console.log('\n=== Import Summary ===');
  for (const Model of MODELS) {
    console.log(`${Model.collection.collectionName}: ${await Model.countDocuments()}`);
  }
  if (skipped > 0) console.log(`Skipped ${skipped} invalid members`);
};

importData()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Import failed, live data left unchanged:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
