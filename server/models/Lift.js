// models/Lift.js
const mongoose = require('mongoose');

const LiftSchema = new mongoose.Schema({
  name: String,
  aerialway: String, // e.g., 'cable_car', 'gondola', 'chair_lift', 'drag_lift', 't-bar', 'j-bar', 'platter', 'rope_tow', etc.
  capacity: Number, // persons per hour or per carrier
  duration: Number, // ride duration in minutes
  status: String, // e.g., 'open', 'closed', 'abandoned'
  oneway: Boolean,
  lit: Boolean,
  length: Number, // in meters (if available)
  description: String,
  // Geographic coordinates
  longitude: Number,
  latitude: Number,
  // Mutual reference to Resort
  resort: { type: mongoose.Schema.Types.ObjectId, ref: 'Resort', required: true }
});

module.exports = mongoose.model('Lift', LiftSchema);