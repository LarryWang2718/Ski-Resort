// Conversation persistence. History is append-only: a turn's messages are written once, in one
// guarded update, after the turn finished, and never edited. That keeps replays byte-identical,
// which the prompt cache and the model's thinking blocks both depend on.
const AssistantConversation = require('../models/AssistantConversation');
const Resort = require('../models/Resort');

// Failed and stopped turns are kept for the record, up to this many turns in all
const MAX_STORED_TURNS = 40;
const TITLE_LENGTH = 60;

const commitQuery = ({ conversationId, userId, expectedTurns, turn, costMicroUsd, lastContextTokens, title }) => {
  const committed = Boolean(turn.apiJson);
  return {
    // Matches only if no other turn was committed since this one started, and there is room left
    filter: {
      _id: conversationId,
      userId,
      committedTurns: expectedTurns,
      [`turns.${MAX_STORED_TURNS - 1}`]: { $exists: false }
    },
    update: {
      $push: { turns: turn },
      $inc: { committedTurns: committed ? 1 : 0, totalCostMicroUsd: costMicroUsd || 0 },
      ...((committed || title) && {
        $set: {
          ...(committed && { lastContextTokens }),
          ...(title && { title: title.slice(0, TITLE_LENGTH) })
        }
      })
    }
  };
};

// The API messages of every completed turn, in order
const replayHistory = (conversation) => conversation.turns
  .filter((turn) => turn.apiJson)
  .flatMap((turn) => JSON.parse(turn.apiJson));

const createStore = ({ Conversation = AssistantConversation } = {}) => ({
  async resortContext(resortId) {
    const resort = await Resort.findById(resortId).select('name location_country location_region').lean();
    return resort && {
      resortId: resort._id,
      name: resort.name,
      country: resort.location_country,
      region: resort.location_region
    };
  },

  async createConversation({ userId, context, model, effort }) {
    const conversation = await Conversation.create({ userId, context, model, effort });
    return conversation.toObject();
  },

  // Raw API messages stay on the server unless the caller needs them for a replay
  findConversation(id, userId, { withApi = false } = {}) {
    return Conversation.findOne({ _id: id, userId })
      .select(withApi ? '-__v' : '-__v -turns.apiJson')
      .lean();
  },

  listConversations(userId) {
    return Conversation.find({ userId })
      .select('title context updatedAt committedTurns')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
  },

  async commitTurn(params) {
    const { filter, update } = commitQuery(params);
    const result = await Conversation.updateOne(filter, update);
    return result.matchedCount === 1;
  }
});

module.exports = { createStore, commitQuery, replayHistory, MAX_STORED_TURNS };
