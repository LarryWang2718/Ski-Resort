// The model links resorts as [Name](/resorts/<id>) and occasionally miscopies one of the 24-character
// ids (two ids in one answer can differ by a few characters). A link whose id no tool returned, but
// whose text is exactly the name of one resort a tool did return, is pointed at that resort.
// Anything else is left alone, and the page shows it as plain text.
const RESORT_LINK = /\[([^\]]+)\]\(\/resorts\/([0-9a-f]{24})((?:\?[^)\s]*)?)\)/g;

const normalize = (name) => name.replace(/\s+/g, ' ').trim().toLowerCase();

// `resorts` is what the tools returned this turn: a Map or array of { id, name }
const repairResortLinks = (text, resorts) => {
  const list = resorts instanceof Map ? [...resorts.values()] : resorts;
  const known = new Set(list.map((resort) => resort.id));
  const byName = new Map();
  for (const resort of list) {
    const key = normalize(resort.name || '');
    byName.set(key, byName.has(key) ? null : resort.id);
  }

  let repaired = 0;
  const fixed = text.replace(RESORT_LINK, (link, label, id, query) => {
    if (known.has(id)) return link;
    const match = byName.get(normalize(label));
    if (!match) return link;
    repaired += 1;
    return `[${label}](/resorts/${match}${query})`;
  });
  return { text: fixed, repaired };
};

module.exports = { repairResortLinks };
