// Runs the assistant against eval/cases.js and grades the answers.
//   npm run eval -- [--mock] [--case id] [--effort low|medium] [--repeat n] [--model id]
// Without --mock this calls the Anthropic API and costs money (roughly $1-2 for all cases at low effort).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const fs = require('fs');
const mongoose = require('mongoose');
const Resort = require('../models/Resort');
const Trail = require('../models/Trail');
const Lift = require('../models/Lift');
const tools = require('../assistant/tools');
const { runTurn } = require('../assistant/agent');
const { buildUserContent } = require('../assistant/prompt');
const { createStore } = require('../assistant/store');
const { createAnthropicModel } = require('../assistant/model');
const { createDemoModel } = require('../assistant/fakeModel');
const { config } = require('../assistant/config');
const { toUsd } = require('../assistant/cost');
const cases = require('./cases');
const { commonChecks } = require('./checks');

const PASS_THRESHOLD = 0.8;

const parseArgs = (argv) => {
  const args = { mock: false, effort: config.effort, model: config.model, repeat: 1, case: null };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--mock') args.mock = true;
    else if (flag === '--case') { args.case = value; i += 1; }
    else if (flag === '--effort') { args.effort = value; i += 1; }
    else if (flag === '--model') { args.model = value; i += 1; }
    else if (flag === '--repeat') { args.repeat = Math.max(1, Number(value) || 1); i += 1; }
  }
  return args;
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

// One case: its turns in order, with history carried over like the route does
const runCase = async (testCase, { model, settings, store }) => {
  const context = testCase.context
    ? await store.resortContext((await Resort.findOne({ name: testCase.context }).select('_id').lean())._id)
    : undefined;
  const calls = [];
  const modelCalls = [];
  const toolbox = {
    ...tools,
    runTool: async (name, input) => {
      const output = await tools.runTool(name, input);
      calls.push({ name, input, isError: output.isError, content: output.content });
      return output;
    }
  };

  let history = [];
  const turns = [];
  for (const [index, question] of testCase.turns.entries()) {
    const started = Date.now();
    try {
      const result = await runTurn({
        model,
        history,
        userContent: buildUserContent(question, index === 0 ? context : undefined),
        settings,
        limits: config.limits,
        toolbox,
        log: (event, fields) => {
          if (event === 'assistant.model_call') {
            modelCalls.push({ index: fields.call, cacheRead: fields.usage?.cacheRead, ms: fields.ms, ttftMs: fields.ttftMs, stopReason: fields.stopReason, usage: fields.usage });
          }
        }
      });
      history = [...history, ...result.messages];
      turns.push({
        status: result.status, text: result.display.text, mapLinks: result.display.mapLinks,
        modelCalls: result.metrics.modelCalls, costMicroUsd: result.metrics.costMicroUsd, repairedLinks: result.metrics.repairedLinks,
        durationMs: Date.now() - started, ttftMs: result.metrics.ttftMs
      });
    } catch (error) {
      turns.push({
        status: 'failed', error: error.code || error.message, text: error.display?.text || '', mapLinks: [],
        modelCalls: error.metrics?.modelCalls || 0, costMicroUsd: error.metrics?.costMicroUsd || 0, durationMs: Date.now() - started
      });
      break;
    }
  }
  return { turns, calls, modelCalls };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.mock && !config.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in server/.env (or use --mock)');
  }
  const model = args.mock
    ? createDemoModel()
    : createAnthropicModel({ apiKey: config.apiKey, timeoutMs: config.limits.sdkTimeoutMs, maxRetries: config.limits.sdkMaxRetries });
  const settings = { model: args.mock ? 'mock' : args.model, effort: args.effort };
  const selected = cases.filter((testCase) => !args.case || testCase.id === args.case);
  if (selected.length === 0) throw new Error(`No case "${args.case}"`);

  await mongoose.connect(process.env.MONGODB_URI);
  const store = createStore();
  const results = [];

  console.log(`${selected.length} cases x ${args.repeat}, ${settings.model} at ${settings.effort} effort\n`);
  for (const testCase of selected) {
    for (let attempt = 1; attempt <= args.repeat; attempt += 1) {
      const expected = await testCase.oracle({ Resort, Trail, Lift });
      const run = await runCase(testCase, { model, settings, store });
      const checks = [...commonChecks(run, { checkCache: !args.mock }), ...(run.turns.every((turn) => turn.status !== 'failed') ? testCase.grade(run, expected) : [])];
      const failed = checks.filter((c) => !c.pass);
      const costUsd = toUsd(run.turns.reduce((sum, turn) => sum + turn.costMicroUsd, 0));
      const durationMs = run.turns.reduce((sum, turn) => sum + turn.durationMs, 0);
      results.push({
        id: testCase.id, attempt, pass: failed.length === 0, checks, costUsd, durationMs,
        modelCalls: run.turns.reduce((sum, turn) => sum + turn.modelCalls, 0),
        repairedLinks: run.turns.reduce((sum, turn) => sum + (turn.repairedLinks || 0), 0),
        tools: run.calls.map((call) => call.name), answers: run.turns.map((turn) => turn.text), calls: run.modelCalls
      });
      console.log(`${failed.length === 0 ? 'PASS' : 'FAIL'}  ${testCase.id.padEnd(24)} $${costUsd.toFixed(4)}  ${(durationMs / 1000).toFixed(1)}s  ${run.calls.map((c) => c.name).join(', ')}${results.at(-1).repairedLinks ? `  (${results.at(-1).repairedLinks} link repaired)` : ''}`);
      for (const c of failed) console.log(`        x ${c.name}${c.detail !== undefined ? `: ${JSON.stringify(c.detail)}` : ''}`);
    }
  }

  const passed = results.filter((result) => result.pass).length;
  const durations = results.map((result) => result.durationMs);
  const summary = {
    model: settings.model,
    effort: settings.effort,
    passRate: passed / results.length,
    totalCostUsd: Number(results.reduce((sum, result) => sum + result.costUsd, 0).toFixed(4)),
    p50Seconds: percentile(durations, 0.5) / 1000,
    p95Seconds: percentile(durations, 0.95) / 1000
  };
  console.log(`\n${passed}/${results.length} passed · $${summary.totalCostUsd} · p50 ${summary.p50Seconds}s · p95 ${summary.p95Seconds}s`);

  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${settings.model}-${settings.effort}.json`);
  fs.writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
  console.log(`Details: ${path.relative(process.cwd(), file)}`);

  await mongoose.disconnect();
  if (summary.passRate < PASS_THRESHOLD) process.exitCode = 1;
};

main().catch(async (error) => {
  console.error('Eval failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
