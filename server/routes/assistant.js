// routes/assistant.js
// Conversations with the AI assistant. A turn is admitted with plain JSON errors (limits, busy,
// not configured), then answered as a stream of server-sent events.
const crypto = require('crypto');
const express = require('express');
const { body, param } = require('express-validator');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const assistant = require('../assistant');
const { runTurn: defaultRunTurn } = require('../assistant/agent');
const { TurnError, classifyError } = require('../assistant/errors');
const { buildUserContent, promptVersion } = require('../assistant/prompt');
const { replayHistory } = require('../assistant/store');
const { openEventStream } = require('../assistant/sse');
const { toUsd } = require('../assistant/cost');
const { logEvent } = require('../assistant/log');

const REFUSAL_TEXT = 'I can\'t help with that one.';

// Logs identify users without storing their ids next to usage data
const userHash = (userId) => crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 12);

const isFull = (conversation, limits) => conversation.committedTurns >= limits.maxTurnsPerConversation
  || conversation.lastContextTokens >= limits.maxContextTokens;

// What the page needs from a stored turn; API messages and thinking never leave the server
const toTurnView = (turn) => ({
  turnId: turn.turnId,
  status: turn.status,
  userText: turn.userText,
  text: turn.display?.text || '',
  tools: turn.display?.tools || [],
  resorts: turn.display?.resorts || [],
  mapLinks: turn.display?.mapLinks || [],
  ...(turn.error?.code && { error: turn.error }),
  createdAt: turn.createdAt
});

const toConversationView = (conversation, limits) => ({
  id: String(conversation._id),
  title: conversation.title || null,
  context: conversation.context?.resortId ? {
    resortId: String(conversation.context.resortId),
    name: conversation.context.name,
    country: conversation.context.country,
    region: conversation.context.region
  } : null,
  full: isFull(conversation, limits),
  updatedAt: conversation.updatedAt,
  turns: (conversation.turns || []).map(toTurnView)
});

const createAssistantRouter = ({
  authenticate = protect,
  getModel = assistant.getModel,
  store = assistant.store,
  quota = assistant.quota,
  registry = assistant.registry,
  settings = assistant.settings,
  limits = assistant.limits,
  runTurn = defaultRunTurn,
  log = logEvent
} = {}) => {
  const router = express.Router();
  router.use(authenticate);

  const conversationId = param('id').isMongoId().withMessage('Invalid conversation id');

  const loadConversation = async (req, options) => {
    const conversation = await store.findConversation(req.params.id, req.user._id, options);
    // Someone else's conversation looks the same as a missing one
    if (!conversation) throw new HttpError(404, 'Conversation not found');
    return conversation;
  };

  // POST /api/assistant/conversations - Start a conversation, optionally about one resort
  router.post('/conversations', [
    body('resortId').optional({ values: 'null' }).isMongoId().withMessage('Invalid resort id')
  ], validate, asyncHandler(async (req, res) => {
    let context;
    if (req.body.resortId) {
      context = await store.resortContext(req.body.resortId);
      if (!context) throw new HttpError(404, 'Resort not found');
    }
    const conversation = await store.createConversation({
      userId: req.user._id, context, model: settings.model, effort: settings.effort
    });
    res.status(201).json({ success: true, data: toConversationView(conversation, limits) });
  }));

  // GET /api/assistant/conversations - The user's recent conversations
  router.get('/conversations', asyncHandler(async (req, res) => {
    const conversations = await store.listConversations(req.user._id);
    res.json({
      success: true,
      data: conversations.map(({ _id, title, context, updatedAt }) => ({
        id: String(_id), title: title || null, resortName: context?.name || null, updatedAt
      }))
    });
  }));

  // GET /api/assistant/conversations/:id - One conversation, for reloading the page
  router.get('/conversations/:id', conversationId, validate, asyncHandler(async (req, res) => {
    res.json({ success: true, data: toConversationView(await loadConversation(req), limits) });
  }));

  // GET /api/assistant/quota - Today's remaining questions
  router.get('/quota', asyncHandler(async (req, res) => {
    res.json({ success: true, data: await quota.status(req.user._id) });
  }));

  const streamTurn = async ({ req, res, model, conversation, admission, requestId, controller }) => {
    const userId = req.user._id;
    const { turnId, message: text } = req.body;
    const logContext = { requestId, conversationId: String(conversation._id), turnId, user: userHash(userId) };

    const stream = openEventStream(res);
    // Stop or a closed tab ends the response early: stop the model so tokens stop being billed
    res.on('close', () => {
      if (!res.writableEnded) controller.abort(new TurnError('stopped'));
    });
    stream.send('start', { turnId });

    let result;
    let failure;
    try {
      result = await runTurn({
        model,
        history: replayHistory(conversation),
        // The resort context belongs to the first message only, so earlier messages never change
        userContent: buildUserContent(text, conversation.committedTurns === 0 ? conversation.context : undefined),
        settings: { model: conversation.model, effort: conversation.effort },
        limits,
        signal: controller.signal,
        emit: stream.send,
        log,
        logContext
      });
    } catch (error) {
      failure = error instanceof TurnError ? error : classifyError(error);
    }

    const outcome = result || failure;
    const metrics = outcome.metrics || {};
    const status = result ? result.status : (failure.code === 'stopped' ? 'stopped' : 'failed');
    const display = { text: '', tools: [], resorts: [], mapLinks: [], ...outcome.display };
    if (status === 'refused') display.text = REFUSAL_TEXT;

    // Saved before `done` is sent, so an answer the user saw is never missing after a reload
    let committed = false;
    try {
      committed = await store.commitTurn({
        conversationId: conversation._id,
        userId,
        expectedTurns: conversation.committedTurns,
        turn: {
          turnId,
          status,
          userText: text,
          apiJson: result?.messages.length ? JSON.stringify(result.messages) : '',
          display,
          error: failure && { code: failure.code, message: failure.message },
          metrics,
          promptVersion: promptVersion(conversation.model),
          createdAt: new Date()
        },
        costMicroUsd: metrics.costMicroUsd,
        lastContextTokens: outcome.lastContextTokens,
        title: conversation.title ? undefined : text
      });
    } catch (error) {
      log('assistant.commit_failed', { ...logContext, error: error.message });
    }
    if (result && !committed) failure = new TurnError('conflict');

    try {
      await quota.settle(userId, requestId, { admittedAt: admission.admittedAt, usage: metrics, refund: failure ? failure.refund : false });
    } catch (error) {
      log('assistant.settle_failed', { ...logContext, error: error.message });
    }

    if (failure) {
      stream.send('error', { code: failure.code, message: failure.message, retryable: failure.retryable });
    } else {
      stream.send('done', {
        status, ...(status === 'refused' && { text: REFUSAL_TEXT }), resorts: display.resorts, mapLinks: display.mapLinks
      });
    }
    stream.close();

    if (failure && ['configuration', 'internal'].includes(failure.code)) {
      console.error(`Assistant turn ${requestId} failed (${failure.code}): ${failure.detail || failure.message}`);
    }
    log('assistant.turn', {
      ...logContext,
      status: failure ? 'failed' : status,
      errorCode: failure?.code,
      errorDetail: failure?.detail,
      modelCalls: metrics.modelCalls,
      toolCalls: metrics.toolCalls,
      tools: display.tools.map(({ name, ok, ms }) => ({ name, ok, ms })),
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      cacheReadTokens: metrics.cacheReadTokens,
      cacheWriteTokens: metrics.cacheWriteTokens,
      costUsd: toUsd(metrics.costMicroUsd || 0),
      ttftMs: metrics.ttftMs,
      durationMs: metrics.durationMs,
      servedBy: metrics.servedBy,
      inputTransformations: metrics.inputTransformations || undefined,
      messageLength: text.length,
      promptVersion: promptVersion(conversation.model)
    });
  };

  // POST /api/assistant/conversations/:id/turns - Ask a question; the answer streams back as SSE
  router.post('/conversations/:id/turns', [
    conversationId,
    body('turnId').isUUID().withMessage('turnId must be a UUID'),
    body('message').isString().withMessage('Message is required').bail()
      .trim()
      .isLength({ min: 1, max: limits.maxMessageLength })
      .withMessage(`Message must be 1 to ${limits.maxMessageLength} characters`)
  ], validate, asyncHandler(async (req, res) => {
    const model = getModel();
    if (!model) {
      throw new HttpError(503, 'The assistant isn\'t configured yet.', { code: 'assistant_not_configured' });
    }

    const conversation = await loadConversation(req, { withApi: true });
    if (isFull(conversation, limits)) {
      throw new HttpError(409, 'This conversation is full. Start a new one.', { code: 'conversation_full' });
    }

    // Cheapest check first: shed load on this instance before touching the database again
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const slot = registry.tryAcquire(requestId, controller);
    if (slot !== 'ok') {
      res.set('Retry-After', '3');
      throw slot === 'draining'
        ? new HttpError(503, 'The server is restarting. Try again.', { code: 'server_restarting' })
        : new HttpError(503, 'The assistant is busy. Try again in a few seconds.', { code: 'at_capacity' });
    }

    try {
      const admission = await quota.admit(req.user._id, requestId);
      await streamTurn({ req, res, model, conversation, admission, requestId, controller });
    } finally {
      registry.release(requestId);
    }
  }));

  return router;
};

module.exports = { createAssistantRouter, toTurnView };
