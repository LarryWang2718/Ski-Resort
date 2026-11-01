// Idempotent schema migration: numeric resort rank, query indexes, unique user email.
// Run with `npm run migrate` from server/. Safe to re-run.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');
const User = require('../models/User');

const migrate = async () => {
  // Build indexes explicitly below instead of on connect
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  // 1. rank was imported as text ("1,234"); store it as a number so it can be indexed and sorted
  const { modifiedCount } = await Resort.collection.updateMany(
    { rank: { $type: 'string' } },
    [{
      $set: {
        rank: {
          $convert: {
            input: { $replaceAll: { input: '$rank', find: ',', replacement: '' } },
            to: 'int',
            onError: null,
            onNull: null
          }
        }
      }
    }]
  );
  console.log(`Converted rank to a number on ${modifiedCount} resorts`);

  // 2. email_1 used to be a plain index; it has to be dropped before the unique one can be built
  const duplicates = await User.aggregate([
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate user emails, resolve them first: ${duplicates.map((d) => d._id).join(', ')}`);
  }
  const emailIndex = (await User.collection.indexes()).find((index) => index.name === 'email_1');
  if (emailIndex && !emailIndex.unique) {
    await User.collection.dropIndex('email_1');
    console.log('Dropped non-unique email_1 index');
  }

  // 3. Create every index declared in the schemas; existing indexes are left untouched
  for (const Model of [Resort, Trail, Lift, User]) {
    await Model.createIndexes();
    const names = (await Model.collection.indexes()).map((index) => index.name);
    console.log(`${Model.modelName} indexes: ${names.join(', ')}`);
  }
};

migrate()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
