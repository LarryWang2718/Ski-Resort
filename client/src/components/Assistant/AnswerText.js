import React from 'react';
import { Link } from 'react-router-dom';

// The small part of Markdown the assistant is asked to use: paragraphs, "- " and "1. " lists,
// **bold** and resort links. Everything becomes React elements, never raw HTML.
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/resorts\/([0-9a-f]{24})(?:\?[^)\s]*)?)\)/g;
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

// Resort ids linked in an answer, in the order they appear
export const linkedResortIds = (text) => [...new Set([...text.matchAll(INLINE)].map((match) => match[4]).filter(Boolean))];

// Links are only rendered for resorts a tool actually returned, so a made-up id stays plain text
function renderInline(text, allowedIds, keyPrefix) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) {
      parts.push(<strong key={key}>{match[1]}</strong>);
    } else if (allowedIds.has(match[4])) {
      parts.push(<Link key={key} to={match[3]}>{match[2]}</Link>);
    } else {
      parts.push(match[2]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Groups lines into paragraphs and lists. A list may follow a line of text directly
// ("Runs:\n- A\n- B"); blank lines separate paragraphs but don't split a list.
export const toBlocks = (text) => {
  const blocks = [];
  let afterBlankLine = false;
  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!rawLine.trim()) {
      afterBlankLine = true;
      continue;
    }
    const type = BULLET.test(rawLine) ? 'ul' : NUMBERED.test(rawLine) ? 'ol' : 'p';
    const line = (type === 'p' ? rawLine : rawLine.replace(type === 'ul' ? BULLET : NUMBERED, ''))
      .replace(/^#{1,6}\s+/, '')
      .trim();
    const last = blocks[blocks.length - 1];
    if (last && last.type === type && (type !== 'p' || !afterBlankLine)) {
      last.lines.push(line);
    } else {
      blocks.push({ type, lines: [line] });
    }
    afterBlankLine = false;
  }
  return blocks;
};

function AnswerText({ text, allowedIds = new Set(), muted = false }) {
  return (
    <div className={`answer-text${muted ? ' answer-text--muted' : ''}`}>
      {toBlocks(text).map(({ type, lines }, index) => {
        const key = `block-${index}`;
        if (type !== 'p') {
          const List = type;
          return (
            <List key={key}>
              {lines.map((line, lineIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={lineIndex}>{renderInline(line, allowedIds, `${key}-${lineIndex}`)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={key}>
            {lines.map((line, lineIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, allowedIds, `${key}-${lineIndex}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default AnswerText;
