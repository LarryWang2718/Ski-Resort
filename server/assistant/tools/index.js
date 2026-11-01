// The assistant's tool registry. Tools only read Resort, Trail and Lift through fixed,
// parameterised queries; the model chooses inputs, never queries.
const { searchResorts, getResortDetails, findResortsNear, listRegions } = require('./resorts');
const { listTrails, listLifts } = require('./features');
const { ToolInputError } = require('./shared');
const { isDatabaseUnavailable, isQueryTimeout } = require('../../utils/dbErrors');

// Order matters: the definitions are part of the cached prompt prefix and must not change between requests
const TOOLS = [searchResorts, getResortDetails, listTrails, listLifts, findResortsNear, listRegions];
const byName = new Map(TOOLS.map((tool) => [tool.name, tool]));

const MAX_RESULT_CHARS = 6000;
const LIST_KEYS = ['resorts', 'runs', 'lifts', 'regions', 'countries'];

const toolDefinitions = Object.freeze(TOOLS.map(({ name, description, input_schema: inputSchema }) => ({
  name,
  description,
  input_schema: inputSchema,
  strict: true
})));

// Drop trailing rows until the result fits, and say so, rather than sending an unbounded result
const fitResult = (result) => {
  let text = JSON.stringify(result);
  const listKey = LIST_KEYS.find((key) => Array.isArray(result[key]));
  if (text.length <= MAX_RESULT_CHARS || !listKey) return text;

  const rows = [...result[listKey]];
  while (rows.length > 0 && text.length > MAX_RESULT_CHARS) {
    rows.pop();
    text = JSON.stringify({
      ...result,
      [listKey]: rows,
      truncated: true,
      note: `Only the first ${rows.length} ${listKey} fit; narrow the filters to see others.`
    });
  }
  return text;
};

// Short text for the activity line in the UI, built from the model's input
const describeToolCall = (name, input) => {
  const tool = byName.get(name);
  if (!tool) return name;
  try {
    return tool.label(input || {});
  } catch {
    return name;
  }
};

class DatabaseUnavailableError extends Error {
  constructor(cause) {
    super('Resort data is temporarily unavailable');
    this.name = 'DatabaseUnavailableError';
    this.cause = cause;
  }
}

// Runs one tool call. Input problems, timeouts and bugs come back as is_error results the model
// can work around; a database outage throws, because without data the model could only guess.
const runTool = async (name, input) => {
  const tool = byName.get(name);
  if (!tool) {
    return { isError: true, content: `Unknown tool "${name}".`, summary: 'unknown tool' };
  }

  try {
    const output = await tool.run(input || {});
    return {
      isError: false,
      content: fitResult(output.result),
      summary: output.summary,
      resorts: output.resorts || [],
      mapLink: output.mapLink
    };
  } catch (error) {
    if (isDatabaseUnavailable(error)) throw new DatabaseUnavailableError(error);
    if (error instanceof ToolInputError) {
      return { isError: true, content: error.message, summary: 'input problem' };
    }
    if (isQueryTimeout(error)) {
      return { isError: true, content: 'The query took too long. Narrow the filters and try again.', summary: 'timed out' };
    }
    console.error(`Tool ${name} failed:`, error);
    return { isError: true, content: 'The tool failed unexpectedly. Answer without it if you can.', summary: 'failed' };
  }
};

module.exports = { toolDefinitions, runTool, describeToolCall, fitResult, DatabaseUnavailableError, MAX_RESULT_CHARS };
