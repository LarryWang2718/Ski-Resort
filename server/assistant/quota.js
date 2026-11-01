// Daily limits and the one-turn-at-a-time lease, enforced in MongoDB so they hold across instances.
// The pure builders are exported for tests; the functions below them talk to the database.
const AssistantUsage = require('../models/AssistantUsage');
const HttpError = require('../utils/httpError');

const RETENTION_DAYS = 35;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (now) => now.toISOString().slice(0, 10);
const userKey = (userId, now) => `u:${userId}:${dayKey(now)}`;
const globalKey = (now) => `global:${dayKey(now)}`;
const nextReset = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
const expiry = (now) => new Date(nextReset(now).getTime() + RETENTION_DAYS * DAY_MS);
const micro = (usd) => Math.round(usd * 1e6);

// One atomic operation: under today's limits, with no live lease, counts the turn and takes the lease.
// The first turn of the day creates the document. If the document exists but a condition fails,
// the upsert collides on _id (duplicate key), which is how a rejection shows up.
const admissionQuery = ({ userId, requestId, now, limits }) => ({
  filter: {
    _id: userKey(userId, now),
    turns: { $lt: limits.dailyTurnsPerUser },
    costMicroUsd: { $lt: micro(limits.dailyCostPerUserUsd) },
    $or: [{ activeUntil: { $exists: false } }, { activeUntil: null }, { activeUntil: { $lte: now } }]
  },
  update: {
    $inc: { turns: 1 },
    $set: { activeRequestId: requestId, activeUntil: new Date(now.getTime() + limits.leaseMs) },
    $setOnInsert: { costMicroUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, expiresAt: expiry(now) }
  }
});

// Why an admission failed, from the document as it is now
const explainRejection = (doc, now, limits) => {
  const resetsAt = nextReset(now).toISOString();
  if (doc && (doc.turns >= limits.dailyTurnsPerUser || doc.costMicroUsd >= micro(limits.dailyCostPerUserUsd))) {
    return new HttpError(429, `You've used today's assistant allowance. It resets at 00:00 UTC.`, {
      code: 'quota_exceeded', details: { resetsAt }
    });
  }
  return new HttpError(409, 'Finish or stop the current answer first.', { code: 'busy' });
};

// After the turn: record what it cost, give the turn back if the failure wasn't the user's doing,
// and release the lease only if it is still ours
const settlementOperations = ({ userId, requestId, now, usage, refund }) => {
  const spent = {
    costMicroUsd: usage.costMicroUsd || 0,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    cacheReadTokens: usage.cacheReadTokens || 0
  };
  return {
    user: [
      { updateOne: { filter: { _id: userKey(userId, now) }, update: { $inc: { ...spent, ...(refund && { turns: -1 }) } } } },
      {
        updateOne: {
          filter: { _id: userKey(userId, now), activeRequestId: requestId },
          update: { $unset: { activeRequestId: 1, activeUntil: 1 } }
        }
      }
    ],
    global: {
      filter: { _id: globalKey(now) },
      update: { $inc: { ...spent, turns: refund ? 0 : 1 }, $setOnInsert: { expiresAt: expiry(now) } }
    }
  };
};

const createQuota = ({ limits, Usage = AssistantUsage, clock = () => new Date() }) => ({
  async admit(userId, requestId) {
    const now = clock();

    // Soft ceiling on total spend: the real cost cap, since anyone can register more accounts
    const global = await Usage.findById(globalKey(now)).select('costMicroUsd').lean();
    if (global && global.costMicroUsd >= micro(limits.dailyGlobalCostUsd)) {
      throw new HttpError(503, 'The assistant is paused for today. Try again tomorrow.', {
        code: 'assistant_paused', details: { resetsAt: nextReset(now).toISOString() }
      });
    }

    const { filter, update } = admissionQuery({ userId, requestId, now, limits });
    try {
      await Usage.collection.findOneAndUpdate(filter, update, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      throw explainRejection(await Usage.findById(filter._id).lean(), now, limits);
    }
    return { day: dayKey(now), admittedAt: now };
  },

  // `admittedAt` pins the day, so a turn that runs past midnight settles on the day it was counted
  async settle(userId, requestId, { admittedAt, usage, refund }) {
    const { user, global } = settlementOperations({ userId, requestId, now: admittedAt, usage, refund });
    await Promise.all([
      Usage.bulkWrite(user, { ordered: true }),
      Usage.updateOne(global.filter, global.update, { upsert: true })
    ]);
  },

  async status(userId) {
    const now = clock();
    const doc = await Usage.findById(userKey(userId, now)).select('turns').lean();
    const used = doc?.turns || 0;
    return {
      turnsUsed: used,
      turnsLimit: limits.dailyTurnsPerUser,
      turnsLeft: Math.max(limits.dailyTurnsPerUser - used, 0),
      resetsAt: nextReset(now).toISOString()
    };
  }
});

module.exports = { createQuota, admissionQuery, explainRejection, settlementOperations, userKey, globalKey, nextReset };
