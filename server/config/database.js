const mongoose = require('mongoose');

const MAX_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Log connection changes once we are up (failed first attempts are logged by the retry loop)
const watchConnection = (connection) => {
  connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  connection.on('reconnected', () => console.log('MongoDB reconnected'));
  connection.on('error', (error) => console.error('MongoDB error:', error.message));
};

// Retry the first connection with exponential backoff; after that the driver reconnects on its own
const connectDB = async () => {
  for (let attempt = 1; ; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        // Fail fast while disconnected instead of queueing queries until they time out
        bufferCommands: false,
        // Production indexes are created by `npm run migrate`, not on every boot
        autoIndex: process.env.NODE_ENV !== 'production'
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      watchConnection(conn.connection);
      return conn;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      const delay = 1000 * 2 ** (attempt - 1);
      console.error(`MongoDB connection failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${error.message}. Retrying in ${delay / 1000}s`);
      await sleep(delay);
    }
  }
};

module.exports = connectDB;
