// Errors that mean MongoDB can't be reached, as opposed to a bad query
const DB_UNAVAILABLE = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNotConnectedError',
  'MongoNetworkError'
]);

const isDatabaseUnavailable = (error) => DB_UNAVAILABLE.has(error?.name);

// MongoDB stopped a query that ran past its maxTimeMS
const isQueryTimeout = (error) => error?.code === 50 || error?.codeName === 'MaxTimeMSExpired';

module.exports = { isDatabaseUnavailable, isQueryTimeout };
