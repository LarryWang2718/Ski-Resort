// Daily limits and the one-turn-at-a-time lease, enforced in MongoDB so they hold across instances.
// The pure builders are exported for tests; the functions below them talk to the database.
const AssistantUsage = require('../models/AssistantUsage');
const HttpError = require('../utils/httpError');

const RETENTION_DAYS = 35;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (now) => now.toISOString().slice(0, 10);
const userKey = (userId, now) => `u:${userId}:${dayKey(now)}`;
const leaseKey = (userId) => `lease:${userId}`;
const globalKey = (now) => `global:${dayKey(now)}`;
const nextReset = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
const expiry = (now) => new Date(nextReset(now).getTime() + RETENTION_DAYS * DAY_MS);
const micro = (usd) => Math.round(usd * 1e6);

// Admission is two atomic steps. First the user's lease, in a document of its own rather than in
// the daily one, so an answer that runs past midnight still holds it. Then the turn is counted
// under today's limits; the first turn of the day creates that document. When a condition fails
// on an existing document, the upsert collides on _id (duplicate key): that is the rejection.
const admissionQueries = ({ userId, requestId, now, limits }) => ({
  lease: {
    filter: {
      _id: leaseKey(userId),
      $or: [{ activeUntil: { $exists: false } }, { activeUntil: null }, { activeUntil: { $lte: now } }]
    },
    update: {
      $set: { activeRequestId: requestId, activeUntil: new Date(now.getTime() + limits.leaseMs), expiresAt: expiry(now) }
    }
  },
  count: {
    filter: {
      _id: userKey(userId, now),
      turns: { $lt: limits.dailyTurnsPerUser },
      costMicroUsd: { $lt: micro(limits.dailyCostPerUserUsd) }
    },
    update: {
      $inc: { turns: 1 },
      $setOnInsert: { costMicroUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, expiresAt: expiry(now) }
    }
  }
});

// Only the request that took the lease can release it
const leaseRelease = (userId, requestId) => ({
  filter: { _id: leaseKey(userId), activeRequestId: requestId },
  update: { $unset: { activeRequestId: 1, activeUntil: 1 } }
});

const busyError = () => new HttpError(409, 'Finish or stop the current answer first.', { code: 'busy' });

// Why counting the turn failed, from the daily document as it is now
const explainRejection = (doc, now, limits) => {
  const resetsAt = nextReset(now).toISOString();
  if (doc && (doc.turns >= limits.dailyTurnsPerUser || doc.costMicroUsd >= micro(limits.dailyCostPerUserUsd))) {
    return new HttpError(429, `You've used today's assistant allowance. It resets at 00:00 UTC.`, {
      code: 'quota_exceeded', details: { resetsAt }
    });
  }
  return busyError();
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
      { updateOne: leaseRelease(userId, requestId) }
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

    const { lease, count } = admissionQueries({ userId, requestId, now, limits });
    try {
      await Usage.collection.findOneAndUpdate(lease.filter, lease.update, { upsert: true });
    } catch (error) {
      throw error.code === 11000 ? busyError() : error;
    }

    try {
      await Usage.collection.findOneAndUpdate(count.filter, count.update, { upsert: true });
    } catch (error) {
      // The turn wasn't counted, so it gives the lease straight back
      const release = leaseRelease(userId, requestId);
      await Usage.updateOne(release.filter, release.update).catch(() => {});
      if (error.code !== 11000) throw error;
      throw explainRejection(await Usage.findById(count.filter._id).lean(), now, limits);
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

module.exports = { createQuota, admissionQueries, explainRejection, settlementOperations, userKey, leaseKey, globalKey, nextReset };
