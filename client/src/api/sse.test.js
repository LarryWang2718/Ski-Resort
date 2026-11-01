import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { readEventStream } from './sse';

// jsdom has no TextDecoder; Node's is the same API
global.TextDecoder = global.TextDecoder || NodeTextDecoder;
const encoder = new NodeTextEncoder();

// A response body that delivers the given strings as separate network chunks
const bodyOf = (chunks) => {
  const queue = chunks.map((chunk) => encoder.encode(chunk));
  return {
    getReader: () => ({
      read: async () => (queue.length > 0 ? { value: queue.shift(), done: false } : { value: undefined, done: true })
    })
  };
};

test('events split across chunks are put back together', async () => {
  const events = [];
  await readEventStream(bodyOf([
    'event: start\ndata: {"turnId":"t"}\n\n: ping\n\nevent: te',
    'xt\ndata: {"delta":"Hel"}\n',
    '\nevent: text\r\ndata: {"delta":"lo"}\r\n\r\nevent: done\ndata: {"status":"complete"}\n\n'
  ]), (name, data) => events.push([name, data]));

  expect(events).toEqual([
    ['start', { turnId: 't' }],
    ['text', { delta: 'Hel' }],
    ['text', { delta: 'lo' }],
    ['done', { status: 'complete' }]
  ]);
});

test('an unfinished event at the end of the stream is ignored', async () => {
  const events = [];
  await readEventStream(bodyOf(['event: text\ndata: {"delta":"a"}']), (name) => events.push(name));
  expect(events).toEqual([]);
});
