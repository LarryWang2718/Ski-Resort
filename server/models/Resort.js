// models/Resort.js
const mongoose = require('mongoose');

const MemberRefSchema = new mongoose.Schema({
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  refType: { type: String, enum: ['trail', 'lift'], required: true }
}, { _id: false });

const ResortSchema = new mongoose.Schema({
  rank: Number,
  name: String,
  rating: String,
  url: String,
  location_coordinate: {
    lat: Number,
    long: Number
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
  members: [MemberRefSchema],

  // Derived by utils/resortFields.js from the text fields above, for filtering, sorting and distance queries
  stats: {
    slope_km: Number,
    lifts: Number,
    slopes: Number,
    top_elevation_m: Number,
    vertical_m: Number,
    snowfall_cm: Number
  },
  // GeoJSON point. `type` is nested, so Mongoose reads it as a field rather than as the field's type.
  // No defaults: an empty coordinates array is invalid GeoJSON and breaks the 2dsphere index.
  location: {
    type: { type: String, enum: ['Point'], default: undefined },
    coordinates: { type: [Number], default: undefined }
  },
  search_name: String
});

ResortSchema.index({ rank: 1 });
ResortSchema.index({ location_country: 1, location_region: 1 });
ResortSchema.index({ location: '2dsphere' });
ResortSchema.index({ search_name: 1 });

module.exports = mongoose.model('Resort', ResortSchema);