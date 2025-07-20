// models/Trail.js
const mongoose = require('mongoose');

const TrailSchema = new mongoose.Schema({
  name: String,
  pisteType: String, // e.g., 'downhill', 'nordic', etc.
  difficulty: String, // e.g., 'novice', 'easy', 'intermediate', 'advanced', 'expert', 'extreme'
  grooming: String, // e.g., 'classic', 'skating', 'backcountry', etc.
  status: String, // e.g., 'open', 'closed', 'abandoned'
  lit: Boolean,
  oneway: Boolean,
  abandoned: Boolean,
  gladed: Boolean,
  patrolled: Boolean,
  groomingPriority: Number, // 1-5
  description: String,
  // Geographic coordinates
  longitude: Number,
  latitude: Number,
  // Mutual reference to Resort
  resort: { type: mongoose.Schema.Types.ObjectId, ref: 'Resort', required: true }
});

module.exports = mongoose.model('Trail', TrailSchema);