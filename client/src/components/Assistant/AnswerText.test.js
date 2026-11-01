import { linkedResortIds, toBlocks } from './AnswerText';

const ID = '690b060fb76e84f97dfdecbb';

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
