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

### Removed
- User reviews (no longer part of the product)
- Early clustering scripts

### Prototypes (not wired in yet)
- `server/models/Weather.js`: schema and condition scoring for a future weather feature

## Next

### AI ski resort assistant (planning)
A chat assistant that answers questions such as "resorts in Austria with 200 km of slopes" by calling tools that query the database.

### Data improvements
- Store resort stats (slope length, elevation, snowfall) as numbers so they can be filtered and sorted
- Store resort locations as GeoJSON with a 2dsphere index for "near me" queries

## Known Limitations
- Trail and lift status is not live. The data is a July 2025 OpenStreetMap snapshot, and OSM rarely records whether a run is open.
- The login token is kept in localStorage for 30 days and cannot be revoked server-side.
- The 5-attempt account lockout is keyed by email, so it can be triggered by someone who knows the address.
- Server tests cover request handling without a database; there are no database integration or browser end-to-end tests yet.
