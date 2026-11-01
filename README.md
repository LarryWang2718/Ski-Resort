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
- Accounts: register, log in (JWT), and edit your profile.

## Technology Stack
- Backend: Node.js, Express, MongoDB, Mongoose
- Client: React, React Router, Redux Toolkit, Axios, react-map-gl (Mapbox GL)
- Tooling: node:test, GitHub Actions, Docker Compose

## Architecture
```
client/  React app (Create React App)
   │  /api  (CRA dev proxy locally, nginx in Docker)
   ▼
server/  Express API  ──▶  MongoDB (resorts, trails, lifts, users)
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
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account or log in |
| `GET /api/auth/me`, `PUT /api/auth/me` | Read or update your profile (Bearer token) |
| `GET /api/health` | Service and database status |

## Testing
```bash
cd server && npm test
```

The server tests use Node's built-in test runner and need no database. GitHub Actions runs them, plus a client build that fails on lint warnings, on every push and pull request.

## Data Sources
Trail, lift and map data are © OpenStreetMap contributors, available under the Open Database License. Base maps are provided by Mapbox.

## License
This project is distributed under the terms described in `LICENSE.md`.

## Contributing
Issues and pull requests are welcome. Please open an issue to discuss major changes before submitting pull requests so we can align on direction.
