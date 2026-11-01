// Server-sent events over a normal POST response. The browser reads it with fetch(), which can send
// the Authorization header (EventSource can't, and a token in the URL would end up in logs).
const HEARTBEAT_MS = 15000;

const openEventStream = (res, { heartbeatMs = HEARTBEAT_MS } = {}) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform stops compressing proxies (the CRA dev server, nginx) from buffering the stream
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const open = () => !res.writableEnded && !res.destroyed;
  // A comment line every so often keeps idle proxies and load balancers from closing the connection
  const heartbeat = setInterval(() => { if (open()) res.write(': ping\n\n'); }, heartbeatMs);

  return {
    send(event, data) {
      if (open()) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(heartbeat);
      if (open()) res.end();
    }
  };
};

module.exports = { openEventStream };
