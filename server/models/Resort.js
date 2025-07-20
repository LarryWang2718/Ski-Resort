// models/Resort.js
const mongoose = require('mongoose');

const MemberRefSchema = new mongoose.Schema({
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  refType: { type: String, enum: ['trail', 'lift'], required: true }
}, { _id: false });

const ResortSchema = new mongoose.Schema({
  rank: String,
  name: String,
  rating: String,
  url: String,
  location_coordinate: {
    lat: String,
    long: String
  },
  location_country: String,
  location_region: String,
  elevation_top_m: String,
  elevation_difference_m: String,
  total_slope_length_km: String,
  number_of_lifts: String,
  number_of_slopes: String,
  annual_snowfall_cm: String,
  number_of_matches: String,
  members: [MemberRefSchema]
});

module.exports = mongoose.model('Resort', ResortSchema);