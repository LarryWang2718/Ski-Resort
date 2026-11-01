// Deterministic graders for assistant answers. No model grades another model here: every
// expected value is computed from the database when the eval runs.
const OBJECT_ID = /[0-9a-f]{24}/g;
const RESORT_LINK = /\[[^\]]+\]\(\/resorts\/([0-9a-f]{24})(?:\?[^)\s]*)?\)/g;

const unique = (values) => [...new Set(values)];

// Resort ids the answer links to, in order
const linkedIds = (text) => unique([...text.matchAll(RESORT_LINK)].map((match) => match[1]));

// Every resort id that appeared anywhere in a tool result during the conversation
const idsFromTools = (calls) => {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) ids.add(value);
  };
  for (const call of calls) {
    if (!call.isError) {
      try {
        visit(JSON.parse(call.content));
      } catch {
        // A non-JSON result has no ids
      }
    }
  }
  return ids;
};

// "1,980", "1980" and "1 980" all count as 1980
const mentionsNumber = (text, number) => {
  const digits = String(Math.round(number));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '[,  ]?');
  return new RegExp(`(^|[^\\d.])${grouped}(?!\\d)`).test(text);
};

const check = (name, pass, detail) => ({ name, pass: Boolean(pass), ...(detail !== undefined && { detail }) });

// Applied to every case. The cache check needs a model that has a prompt cache (not the mock).
const commonChecks = ({ turns, calls, modelCalls }, { checkCache = true } = {}) => {
  const text = turns.map((turn) => turn.text).join('\n');
  const allowed = idsFromTools(calls);
  const ungrounded = linkedIds(text).filter((id) => !allowed.has(id));
  const bareIds = (text.replace(RESORT_LINK, '').match(OBJECT_ID) || []);
  const failed = turns.filter((turn) => turn.status !== 'complete');
  // Every call after the first in a turn re-reads the cached prefix
  const coldCalls = modelCalls.filter((call) => call.index > 1 && !(call.cacheRead > 0));

  return [
    check('completed', failed.length === 0, failed.map((turn) => turn.error || turn.status).join('; ') || undefined),
    check('links grounded in tool results', ungrounded.length === 0, ungrounded.length ? ungrounded : undefined),
    check('no bare ids in text', bareIds.length === 0, bareIds.length ? bareIds : undefined),
    check('at most 4 model calls per turn', turns.every((turn) => turn.modelCalls <= 4), turns.map((turn) => turn.modelCalls)),
    ...(checkCache ? [check('cache read after the first call', coldCalls.length === 0, coldCalls.length ? `${coldCalls.length} cold calls` : undefined)] : [])
  ];
};

// Of the resorts the oracle expects, how many the answer links (and none outside it)
const precisionRecall = (linked, expected) => {
  const expectedSet = new Set(expected);
  const hits = linked.filter((id) => expectedSet.has(id));
  return {
    precision: linked.length === 0 ? 1 : hits.length / linked.length,
    recall: expected.length === 0 ? 1 : hits.length / expected.length
  };
};

module.exports = { linkedIds, idsFromTools, mentionsNumber, commonChecks, precisionRecall, check };
