// Turns running on this instance: a cap so one instance sheds load instead of piling up slow,
// costly requests, and a registry so shutdown can stop them. Correctness never depends on it;
// per-user limits live in MongoDB.
const { TurnError } = require('./errors');

const createTurnRegistry = ({ maxConcurrent }) => {
  const active = new Map();
  let draining = false;

  return {
    // 'ok', 'full' or 'draining'
    tryAcquire(requestId, controller) {
      if (draining) return 'draining';
      if (active.size >= maxConcurrent) return 'full';
      active.set(requestId, controller);
      return 'ok';
    },

    release(requestId) {
      active.delete(requestId);
    },

    get size() {
      return active.size;
    },

    // Refuse new turns, give running ones `graceMs` to finish, then stop the rest
    async drain(graceMs) {
      draining = true;
      const deadline = Date.now() + graceMs;
      while (active.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      }
      for (const controller of active.values()) {
        controller.abort(new TurnError('server_restarting'));
      }
      // Let aborted turns record themselves before the database connection closes
      const settleBy = Date.now() + 2000;
      while (active.size > 0 && Date.now() < settleBy) {
        await new Promise((resolve) => { setTimeout(resolve, 50); });
      }
    }
  };
};

module.exports = { createTurnRegistry };
