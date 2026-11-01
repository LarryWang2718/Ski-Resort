const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];

// Fail at startup rather than on the first request that needs a missing value
const validateEnv = () => {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = validateEnv;
