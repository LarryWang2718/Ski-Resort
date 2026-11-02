import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnswerText, { linkedResortIds, toBlocks } from './AnswerText';

const ID = '690b060fb76e84f97dfdecbb';
const OTHER_ID = '690b0638b76e84f97dfe6009';

const renderAnswer = (text, allowedIds) => render(
  <MemoryRouter><AnswerText text={text} allowedIds={new Set(allowedIds)} /></MemoryRouter>
);

test('a list can follow a line of text without a blank line', () => {
  expect(toBlocks('Chamonix has 2 runs:\n- Bouquetins\n- Floria\n\nEnjoy.')).toEqual([
    { type: 'p', lines: ['Chamonix has 2 runs:'] },
    { type: 'ul', lines: ['Bouquetins', 'Floria'] },
    { type: 'p', lines: ['Enjoy.'] }
  ]);
});

test('blank lines split paragraphs but not lists', () => {
  expect(toBlocks('One.\n\nTwo.\n1. A\n\n2. B')).toEqual([
    { type: 'p', lines: ['One.'] },
    { type: 'p', lines: ['Two.'] },
    { type: 'ol', lines: ['A', 'B'] }
  ]);
});

test('headings are shown as plain lines', () => {
  expect(toBlocks('## Results\nText')).toEqual([{ type: 'p', lines: ['Results', 'Text'] }]);
});

test('linked resort ids are found in order, once each', () => {
  const text = `[Chamonix](/resorts/${ID}) and [map](/resorts/${ID}?difficulty=advanced), not [x](https://example.com)`;
  expect(linkedResortIds(text)).toEqual([ID]);
});

test('a bold link is found and rendered as a link, without showing its id', () => {
  const text = `- **[Ski Arlberg (St.Anton)](/resorts/${ID})** in Tyrol: 301 km of slopes`;
  expect(linkedResortIds(text)).toEqual([ID]);

  const { container } = renderAnswer(text, [ID]);
  const link = screen.getByRole('link', { name: 'Ski Arlberg (St.Anton)' });
  expect(link.getAttribute('href')).toBe(`/resorts/${ID}`);
  expect(link.closest('strong')).not.toBeNull();
  expect(container.textContent).not.toContain(ID);
});

test('a link to a resort no tool returned shows its name only', () => {
  const { container } = renderAnswer(`**[Made Up](/resorts/${OTHER_ID})** and [Also Made Up](/resorts/${OTHER_ID})`, [ID]);
  expect(screen.queryByRole('link')).toBeNull();
  expect(container.textContent).toBe('Made Up and Also Made Up');
});
