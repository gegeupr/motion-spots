# Texto para a inscrição (Builder Center)

## Título
Motion Spots: where to train outdoors in Ponta Grossa

## Dataset
OpenStreetMap places in Ponta Grossa, Brazil, tagged as outdoor gyms, pitches, tracks, sports centres, parks and playgrounds (public data, ODbL, no personal information). Each place has coordinates, a type and sometimes a name and sport.

## How I put it on the map
The places are drawn with MapLibre GL JS over an Amazon Location Service base map (Standard style). Dense areas are clustered, and the user can filter by place type or name. When the user taps a spot, the app calls the Amazon Location Routes API (CalculateRoutes, pedestrian mode) to draw the walking route and show distance and time from a starting point. The starting point can be the user's location, a point on the map, or an address geocoded with Amazon Location Places (SearchText). I used Amazon Location because it gives the map, routing and geocoding behind one API key, with no servers to run.

## AWS services
Amazon Location Service (Maps, Routes, Places).

## What people can explore
Find the closest training spots, compare walking times, and open a spot to get a generic workout suggestion for that kind of place.

## Live map
https://motion-spots.vercel.app

## Code
(link do repositório público, se publicar)

## Demo video (under 3 minutes) - roteiro
1. 0:00 Open the map and show the clusters over Ponta Grossa.
2. 0:20 Filter by type (outdoor gym) and by name.
3. 0:45 Type an address as the starting point.
4. 1:15 Tap a spot, show the route, distance and walking time.
5. 1:45 Show the workout suggestion and the "open in maps" button.
6. 2:15 Explain: OpenStreetMap data + Amazon Location Maps, Routes and Places, and how to reuse it for other places.
