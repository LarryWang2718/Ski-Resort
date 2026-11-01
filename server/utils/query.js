// Helpers for turning untrusted query-string values into safe Mongo filters

const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

// Clamp page and limit so bad input can't produce a negative skip or an unbounded page
const parsePagination = (query, { defaultLimit = 20, maxLimit = MAX_LIMIT } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

// Only accept plain, non-empty strings (rejects arrays from repeated keys)
const stringParam = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const booleanParam = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

// Match user text literally and case-insensitively, never as a regular expression
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsText = (text) => ({
  $regex: escapeRegex(text.slice(0, MAX_SEARCH_LENGTH)),
  $options: 'i'
});

module.exports = { parsePagination, stringParam, booleanParam, escapeRegex, containsText };
