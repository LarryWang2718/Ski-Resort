# Ski-Resort

## Overview
Ski-Resort is a full-stack web application that helps skiers discover resorts, explore trail maps, and plan mountain adventures. It combines a ranked directory of ski resorts with every piste and lift mapped in OpenStreetMap, drawn on an interactive trail map.

## Demo
<!-- Screenshots to be added -->

## Features
- Ranked directory of 3,284 resorts in 13 countries, searchable by name and filterable by country and region.
- Resort pages with slope length, lift count, elevation, vertical drop and snowfall, plus an interactive Mapbox trail map.
- 88,837 trails and 20,483 lifts from OpenStreetMap, colour-coded by difficulty and lift type, with details on click.
- Trail and lift browsers with search, difficulty or lift-type filters, and a resort filter.
- AI assistant: ask in plain language ("Which black runs does Chamonix have?"). Answers come from the site's own data through read-only tools, stream in as they are written, link to resort pages, and can highlight the runs they describe on the trail map.
- Accounts: register, log in (JWT), and edit your profile.

## Technology Stack
- Backend: Node.js, Express, MongoDB, Mongoose
- AI: Claude API (`claude-opus-5-5`) with tool use, streamed to the browser as server-sent events
- Client: React, React Router, Redux Toolkit, Axios, react-map-gl (Mapbox GL)
- Tooling: node:test, GitHub Actions, Docker Compose

## Architecture
```
client/  React app (Create React App)
   │  /api  (CRA dev proxy locally, nginx in Docker)
   ▼
server/  Express API  ──▶  MongoDB (resorts, trails, lifts, users, assistant conversations and usage)
   ├─ assistant/  agent loop, tools, quotas, streaming  ──▶  Claude API
   └─ scripts/  OSM data pipeline, import and migrations
```

### Backend
- `app.js` builds the Express app; `server.js` validates the environment, connects to MongoDB (retrying with backoff), starts listening and shuts down cleanly on SIGTERM/SIGINT.
- Routes stay free of try/catch: `asyncHandler` forwards errors to one `errorHandler`, which turns bad ids, validation failures and duplicates into 4xx responses, a database outage into 503, and hides details of unexpected 500s.
- Untrusted query strings are clamped and sanitised (`utils/query.js`): page and limit are bounded, search text is matched literally rather than as a regex, and nested query operators such as `?field[$ne]=` are ignored.
- Indexes on `trails.resort` and `lifts.resort` mean a resort page reads only its own trails (902 for Les 3 Vallées) instead of scanning all 88,837. List endpoints omit map geometry.
- `GET /api/health` reports database status for monitors and container health checks.

### Frontend
- A shared Axios client adds the token, times out after 15 seconds and logs the user out when the API rejects their session.
- `useApi` cancels outdated requests, so fast paging never shows stale results, and every page has loading, error-with-retry and empty states. An error boundary keeps one broken page from blanking the app.
- Search filters live in the URL, so links can be shared and Back returns to the same results.

## AI Assistant
The assistant answers questions about the directory by calling tools that query MongoDB. The model chooses tool inputs; it never writes queries.

```
browser (fetch, reads the SSE stream)
   │ POST /api/assistant/conversations/:id/turns
   ▼
API instance
   1. validate input; load the conversation (only the owner's)
   2. take a slot on this instance          (full: 503 + Retry-After)
   3. one atomic MongoDB update: daily quota + per-user lease   (429 / 409)
   4. agent loop: Claude <-> read-only tools, at most 5 model calls, 60 s deadline
   5. save the turn in one guarded update, record its cost, send `done`
events: status · tool_start / tool_end · text · done | error
```

### Design
- **Six fixed tools** over Resort, Trail and Lift: search and filter resorts, details and comparisons, named runs, lifts, resorts nearby (`$geoNear` on a 2dsphere index) and countries/regions. Strict JSON schemas, server-side range clamping, a 3 s query limit and results capped at 6 KB. Tools never read users and never return free-text OSM descriptions.
- **Grounded links.** The page renders a resort link only if a tool returned that id in the same turn, so a made-up id stays plain text. The eval caught the model miscopying one of two near-identical 24-character ids, so the server also repairs a link whose text exactly names a resort the tools returned (`assistant/links.js`); the model's own message is stored unchanged.
- **Append-only history.** Each turn's messages are stored as exact JSON and replayed byte for byte, which keeps the prompt cache warm and the model's earlier reasoning valid. The system prompt and tools never change within a conversation; page context goes in the first message.
- **Stateless instances.** Conversations, quotas and leases live in MongoDB, so any instance can serve any turn: `docker compose up --scale api=3` runs three API containers behind nginx, and every log line names the instance that handled it.
- **Cost control.** Per-user daily turns and spend, a global daily budget (the real ceiling, since accounts are free), prompt caching, low effort, output caps, and stopping the model when the browser disconnects.
- **Refusal fallback.** A safety-classifier decline is re-run on Anthropic's recommended fallback model (`fallbacks: "default"`).

### Failure handling
| Situation | What happens |
| --- | --- |
| Daily allowance or global budget used | 429 / 503 before any model call; the page shows when it resets |
| A second question while one is answering | 409 from the per-user lease, on any instance |
| Instance at capacity or restarting | 503 with `Retry-After`; on shutdown, running answers stop and are recorded |
| Claude rate limit, overload or outage | SDK retries twice, then a retryable error; the turn is refunded |
| Stream breaks mid-answer, deadline or 20 s of silence | Partial text stays greyed out with Retry; nothing half-finished is saved |
| A tool gets bad input or times out | The error goes back to the model, which corrects itself |
| Database down | The turn stops rather than letting the model guess |
| User presses Stop or closes the tab | The model call is cancelled, so billing stops |

### Measured
From the eval on 2026-11-02 (14 cases, 15 questions, `claude-opus-5-5`):

| Effort | Passed | Cost of the run | Per case (median) | Time per case p50 / p95 |
| --- | --- | --- | --- | --- |
| low (used) | 14/14 | $0.17 | $0.010 | 5.8 s / 12.8 s |
| medium | 13/14 (14/14 regraded) | $0.22 | $0.012 | 6.3 s / 13.9 s |

- Medium was 31% more expensive and slower with no gain in accuracy, so the assistant runs at low effort.
- A typical question takes two model calls (one to choose a tool, one to answer) of about 2.5 s each. 98% of input tokens were read from the prompt cache.
- Both runs miscopied one resort id (the same one), and both were repaired. The medium run's one failure was the grader missing a correct "not in the directory" answer; the check was widened.

### Running it
- No key needed for development: set `ASSISTANT_PROVIDER=mock` in `server/.env` for a rule-based stand-in that calls the real tools. Add `MOCK_FAILURE=rate_limit` (or `overloaded`, `slow`, `refusal`, `tool_error`) to see each error path.
- With a key: set `ANTHROPIC_API_KEY` in `server/.env`. Limits and the model are configured there too (see `server/.env.example`).
- Eval: `npm run eval -- --mock` checks the harness for free; `npm run eval -- --effort low` runs 14 graded cases against Claude (about $0.20). Expected answers are computed from the database at run time, and every answer is checked for ungrounded links and prompt-cache hits.

## Getting Started
Requirements: Node.js 20 or newer, a MongoDB database (MongoDB Atlas works), and a Mapbox access token.

```bash
cp server/.env.example server/.env   # set MONGODB_URI and JWT_SECRET
cp client/.env.example client/.env   # set REACT_APP_MAPBOX_TOKEN

cd server && npm install && npm run dev    # API on http://localhost:5000
cd client && npm install && npm start      # app on http://localhost:3000
```

With Docker, build and run both services behind nginx on http://localhost:8080:

```bash
REACT_APP_MAPBOX_TOKEN=pk.your-token docker compose up --build
```

## Data Pipeline
The database is built offline from OpenStreetMap:

1. `node server/scripts/fetch/fetchSkiResortsAndFeatures.js` downloads every downhill piste and aerialway from the Overpass API into `skiresorts_clean.json`.
2. `node server/scripts/mergeNodesWaysToSkiResorts.js` assigns each trail and lift to the nearest resort in a ranked resort list (`ski-resorts.json`, not included) within 10 km, favouring resorts that already have nearby members, and writes `ski-resorts-with-members.json`.
3. `npm run import` (in `server/`) loads that file into MongoDB. It writes to staging collections and swaps them in only after everything succeeded, so a failed run leaves the live data untouched.
4. `npm run migrate` (in `server/`) applies idempotent schema changes and creates indexes.

The data files are large and are not committed; regenerate them with the scripts above.

## API
`GET /` on the API lists every endpoint. The main ones:

| Endpoint | Description |
| --- | --- |
| `GET /api/resorts?q=&country=&region=&page=&limit=` | Resorts sorted by rank (limit up to 100) |
| `GET /api/resorts/filters` | Countries and their regions |
| `GET /api/resorts/:id` | One resort with its trails and lifts |
| `GET /api/trails?q=&difficulty=&resort=` | Trails, paginated |
| `GET /api/lifts?q=&aerialway=&resort=` | Lifts, paginated |
| `POST /api/assistant/conversations` | Start an assistant conversation, optionally about one resort |
| `POST /api/assistant/conversations/:id/turns` | Ask a question; the answer streams as server-sent events |
| `GET /api/assistant/conversations/:id`, `GET /api/assistant/quota` | Reload a conversation; questions left today |
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account or log in |
| `GET /api/auth/me`, `PUT /api/auth/me` | Read or update your profile (Bearer token) |
| `GET /api/health` | Service and database status |

## Testing
```bash
cd server && npm test                      # API and assistant, no database or API key needed
cd client && npm test -- --watchAll=false  # answer rendering and stream parsing
```

The server tests use Node's built-in test runner. The assistant is tested against a scripted stand-in for the model: tool round trips, every stop reason, timeouts, disconnects, error mapping, and two invariants that protect the prompt cache (requests only append to the history; the system prompt and tools never change). GitHub Actions runs both suites, plus a client build that fails on lint warnings, on every push and pull request.

## Data Sources
Trail, lift and map data are © OpenStreetMap contributors, available under the Open Database License. Base maps are provided by Mapbox.

## License
This project is distributed under the terms described in `LICENSE.md`.

## Contributing
Issues and pull requests are welcome. Please open an issue to discuss major changes before submitting pull requests so we can align on direction.
