# Motion Spots

An interactive map of outdoor training spots in Ponta Grossa, Brazil (outdoor gyms, pitches, tracks, parks, sports centres).
Pick a starting point, choose a spot, and see the walking distance and time. Built for the AWS Builder Center map challenge.

**Live map:** https://motion-spots.vercel.app

## Dataset
- **Source:** OpenStreetMap (ODbL), places tagged `leisure=fitness_station | pitch | track | sports_centre | park | playground` inside the Ponta Grossa municipality.
- **How to get it:** run this on https://overpass-turbo.eu and export as GeoJSON, saved as `pontos.geojson`:

```
[out:json][timeout:60];
area["name"="Ponta Grossa"]["admin_level"="8"]->.a;
nwr(area.a)["leisure"~"^(fitness_station|pitch|track|sports_centre|park|playground)$"];
out center;
```
- No personal data. Only public places.

## How it works
- **Amazon Location Service - Maps:** base map (Standard style) drawn with MapLibre GL JS.
- **Amazon Location Service - Routes:** `CalculateRoutes` (Pedestrian) returns the walking route, distance and time to the chosen spot.
- **Amazon Location Service - Places:** `SearchText` geocodes an address typed by the user into the starting point.
- Points are clustered on the map, filtered by place type and by name, and sorted by distance from the starting point.
- Everything runs in the browser. The user's location is never stored or sent anywhere except to Amazon Location when a route is requested.

## Run it
1. In the AWS console, create an Amazon Location **API key** in `us-east-1` allowing only these read actions: Maps (`GetTile`, `GetStyleDescriptor`, `GetSprites`, `GetGlyphs`), Routes (`CalculateRoutes`) and Places (`SearchText`). Set an expiry date.
2. Copy `config.example.js` to `config.js` and set `API_KEY`. `config.js` is in `.gitignore`, so your key is not committed.
3. Put `pontos.geojson` next to `index.html` (already included, 295 places).
4. Serve the folder with any static server (`npx serve .`) or deploy it to Vercel/S3. When deploying with the Vercel CLI, `.vercelignore` makes sure `config.js` is uploaded.
5. Restrict the key to your domain under *Client restrictions* (referrer, e.g. `https://your-app.vercel.app/*`). To test locally with a restricted key, also allow `http://localhost:*`.

The API key is visible in the browser by design, so keep it limited to read-only actions, restrict the allowed referrers to your domain and give it an expiry date. If the map shows a 403 error, check the referrer restriction and the expiry date.

## What was built and tested
- 295 places from OpenStreetMap (133 pitches, 110 parks, 25 playgrounds, 22 sports centres, 3 tracks, 2 outdoor gyms).
- Base map, walking routes and address search all verified against the live deployment.
- Route distance and time come from the Routes API (`Legs[].PedestrianLegDetails.Summary.Overview`), with a straight-line estimate as a fallback if the API is unreachable.

## Reuse the pattern
Swap `pontos.geojson` and the `CATS` table in `app.js` to map any set of places (pharmacies, bike racks, schools).

Data: © OpenStreetMap contributors. Map and routes: Amazon Location Service.
