# Pahadi Maps prototype

A frontend focused prototype for safer mountain journeys, based on the project presentation. It demonstrates community road hazard reports, a route preview, map layers, nearby helpers, local businesses, offline saved data, and a prototype SOS workflow.

## Run it

Requires Node.js 18 or newer. There are no npm dependencies or build step.

```sh
node server.js
```

Open [http://localhost:3000](http://localhost:3000). The map uses Leaflet and OpenStreetMap tiles, so the interactive map needs an internet connection. The app shell and the most recently loaded lists remain available from the browser's local storage when the API is unreachable.

The frontend can also be served from a static host such as GitHub Pages. In static mode, the bundled JSON files supply the sample map data; new hazard reports and SOS demo alerts are stored only in that browser's local storage. Run the Node server for JSON-backed reports and alerts.

## Prototype flows

- Use **View safer route** to draw a sample Dehradun–Mussoorie route.
- Use **Layers** to show or hide hazards, helpers, and local places.
- Select **Report a road hazard** to submit a report; it is validated and saved in `data/hazards.json`.
- Select **Emergency SOS** to create a local prototype alert saved in `data/alerts.json`. It reports the number of seeded community helpers, but does not contact real people or emergency services.
- Use the location button to center the map on your device, with browser location permission.
- Search for a local landmark or click a hazard/place card to center the map there.

## API

- `GET /api/health` — server status
- `GET /api/data` — hazards, helpers, and local places
- `POST /api/hazards` — add a validated road report
- `POST /api/sos` — record a prototype help request

Seed data is fictional and centered around Mussoorie. JSON files are used instead of a database to keep setup small and make the prototype easy to inspect. For real deployment, add authentication, consent and verification flows, real helper availability, emergency service integration, abuse controls, and a production spatial database.
