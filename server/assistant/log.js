// One JSON line per event, so logs from every instance can be searched and aggregated.
// Message text is never logged; the conversation itself is stored per user.
const os = require('os');

const INSTANCE = os.hostname();

const logEvent = (event, fields = {}) => {
  if (process.env.NODE_ENV === 'test') return;
  console.log(JSON.stringify({ time: new Date().toISOString(), event, instance: INSTANCE, ...fields }));
};

module.exports = { logEvent, INSTANCE };
