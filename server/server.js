const path = require('path');
// Load server/.env no matter which directory the process starts from
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const mongoose = require('mongoose');
const validateEnv = require('./config/env');
const connectDB = require('./config/database');
const app = require('./app');

const SHUTDOWN_TIMEOUT_MS = 10000;

const start = async () => {
  validateEnv();
  // Only accept traffic once the database is reachable
  await connectDB();

  const port = process.env.PORT || 5000;
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`API Documentation: http://localhost:${port}`);
  });

  let shuttingDown = false;
  const shutdown = (reason, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${reason}: closing HTTP server and database connection`);

    // Don't hang forever on a stuck request
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      await mongoose.connection.close();
      process.exit(exitCode);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    shutdown('Unhandled rejection', 1);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
