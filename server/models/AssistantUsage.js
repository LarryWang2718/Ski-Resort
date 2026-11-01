// models/AssistantUsage.js
// One document per user per UTC day ("u:<userId>:<day>") plus one for everyone ("global:<day>").
// Kept in MongoDB rather than in memory so limits hold across every API instance.
const mongoose = require('mongoose');

const AssistantUsageSchema = new mongoose.Schema({
  _id: String,
  turns: { type: Number, default: 0 },
  costMicroUsd: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  cacheReadTokens: { type: Number, default: 0 },
  // Lease for the user's one in-flight turn; it expires on its own if an instance dies mid-turn
  activeRequestId: String,
  activeUntil: Date,
  expiresAt: Date
}, { versionKey: false });

// MongoDB deletes old usage documents once expiresAt passes
AssistantUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AssistantUsage', AssistantUsageSchema);
