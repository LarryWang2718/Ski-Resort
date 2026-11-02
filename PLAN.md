# Ski Resort Finder: Status and Roadmap

## Current State (November 2026)

### Done
- Resort directory ranked by `rank`, with text search and country/region filters
- Resort detail pages with stats, an interactive trail map (popups on trails and lifts) and trail/lift lists
- Trail and lift browsers with search, type filters and a resort filter
- JWT authentication: register, log in, profile edit, session-expiry handling
- API hardening: central error handling, input sanitising, pagination limits, health check, startup retries, graceful shutdown
- Indexes for resort pages and list sorting; idempotent `npm run migrate`
- Import script that swaps in new data only after a complete run
- Server test suite (node:test) and GitHub Actions CI
- Docker Compose setup (API plus nginx-served client)
- AI assistant: streamed answers from read-only database tools, daily quotas and a global budget, a per-user lease, shutdown draining, refusal fallback, map highlighting, a mock model for development and a graded eval
- Eval run against Claude: 14/14 at low effort for $0.17; medium cost 31% more with no accuracy gain, so low is the default
- Numeric resort stats, GeoJSON locations (2dsphere) and accent-insensitive names, kept in sync by both the migration and the import

### Removed
- User reviews (no longer part of the product)
- Early clustering scripts

### Prototypes (not wired in yet)
- `server/models/Weather.js`: schema and condition scoring for a future weather feature

## Next
- Have tools return short per-turn resort handles instead of 24-character ids, so the model has nothing long to copy (links are repaired by name today)
- An LLM grader for the refusal-style eval cases; the keyword checks have twice missed a correctly worded answer
- Resumable answers: a dropped connection currently ends the turn; an event log (for example Redis Streams with `Last-Event-ID`) would let the browser reconnect to the same answer
- Move the general rate limiter to a shared store; it counts per instance today
- Admin view of assistant usage: latency percentiles, cost, error codes and cache-hit ratio (the data is already stored per turn)
- Search the resort list by the numeric stats, as the assistant already can

## Known Limitations
- Trail and lift status is not live. The data is a July 2025 OpenStreetMap snapshot, and OSM rarely records whether a run is open.
- The login token is kept in localStorage for 30 days and cannot be revoked server-side.
- The 5-attempt account lockout is keyed by email, so it can be triggered by someone who knows the address.
- Server tests cover request handling without a database; there are no database integration or browser end-to-end tests yet.
- The assistant has no live information (opening status, snow, weather, prices) and says so.
