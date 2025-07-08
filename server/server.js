const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const connectDB = require('./config/database');
connectDB();

// Import models
const User = require('./models/User');
const Resort = require('./models/Resort');
const Trail = require('./models/Trail');
const Lift = require('./models/Lift');
const Weather = require('./models/Weather');
const Review = require('./models/Review');

console.log('All models loaded successfully!');

// Import routes
const resortRoutes = require('./routes/resorts');

// Use routes
app.use('/api/resorts', resortRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Ski Resort API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});