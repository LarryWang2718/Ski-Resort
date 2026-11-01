// Reads a text/event-stream response body and calls onEvent(name, data) for each event.
// Events can arrive split across network chunks, so text is buffered until a blank line ends one.
const dispatchEvent = (chunk, onEvent) => {
  let name = 'message';
  const data = [];
  for (const line of chunk.split('\n')) {
    // Lines starting with ":" are comments (the server's keep-alive pings)
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') name = value;
    if (field === 'data') data.push(value);
  }
  if (data.length > 0) onEvent(name, JSON.parse(data.join('\n')));
};

export async function readEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      dispatchEvent(buffer.slice(0, boundary), onEvent);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
  }
}
