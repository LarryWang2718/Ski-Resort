# Ski-Resort

## Overview
Ski-Resort is a full-stack web application that helps skiers discover resorts, explore trail maps, and plan mountain adventures. The site combines resort profiles, lift and trail statistics, user reviews, and real-time weather updates to give visitors an informed view before they head to the slopes.

## Features
- Browse detailed resort pages with lift counts, trail difficulty breakdowns, operating hours, and ticket information.
- View interactive maps that highlight terrain, lifts, and amenities powered by OpenStreetMap data.
- Register for an account, securely authenticate, and contribute community reviews and ratings.
- Track live weather and snowfall summaries to decide when conditions are ideal.

## Technology Stack
- Backend: Node.js, Express, MongoDB, Mongoose
- Client: React, React Router, Axios
- Tooling: npm scripts, environment-based configuration

## Getting Started
1. Clone this repository and install dependencies for both the `server` and `client` directories.
2. Configure the required environment variables (database URI, JWT secret, and weather API credentials).
3. Run `npm run dev` or equivalent scripts to start the backend server and client development environment.
4. Visit the client URL in your browser to browse resorts, search for trails, and sign in to unlock review features.

## Data Sources
Map layers and geographic context are sourced from OpenStreetMap contributors under the Open Database License. Weather information is fetched from the configured weather API provider as defined in the environment settings.

## License
This project is distributed under the terms described in `LICENSE.md`.

## Contributing
Issues and pull requests are welcome. Please open an issue to discuss major changes before submitting pull requests so we can align on direction.