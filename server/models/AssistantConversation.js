// models/AssistantConversation.js
const mongoose = require('mongoose');

const TurnSchema = new mongoose.Schema({
  turnId: { type: String, required: true },
  status: { type: String, enum: ['complete', 'truncated', 'refused', 'failed', 'stopped'], required: true },
  userText: { type: String, required: true },
  // The exact API messages this turn added, as JSON text, replayed byte for byte on later turns.
  // Text rather than an object because Mongoose drops empty objects, which would break a tool call
  // with `input: {}`. Empty for turns that didn't complete, which are kept for history only.
  apiJson: { type: String, default: '' },
  // What the page shows: answer text, tool steps, resorts found, map links
  display: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { code: String, message: String },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  promptVersion: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const AssistantConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  // The resort page the conversation was started from, if any
  context: {
    resortId: mongoose.Schema.Types.ObjectId,
    name: String,
    country: String,
    region: String
  },
  // Pinned per conversation: prompt caches and thinking blocks belong to one model
  model: { type: String, required: true },
  effort: { type: String, required: true },
  // Only completed turns count; commits are guarded on this value so two writers can't interleave
  committedTurns: { type: Number, default: 0 },
  lastContextTokens: { type: Number, default: 0 },
  totalCostMicroUsd: { type: Number, default: 0 },
  turns: [TurnSchema]
}, { timestamps: true });

AssistantConversationSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('AssistantConversation', AssistantConversationSchema);
