# nine2two (922)

**When it's almost an emergency.**

A mobile-first, community-powered restroom finder — MVP v1.0 per the product
PRD. Beachhead market: Hollywood / Los Angeles. Users drop pins on a map for
public restrooms, rate their cleanliness (1–5 stars), tag features (free,
accessible, changing table, gender neutral, key/code required, 24 hours), and
leave condition reports so the next person knows what to expect.

## Features

- 📍 **Interactive map** (Leaflet + OpenStreetMap) with color-coded score
  pins, centered on your location or Hollywood as fallback
- ➕ **Add a restroom** — tap the ＋ button, then tap the map to place it
- ✦ **Cleanliness scores** — live average of community ratings, from
  "Sparkling" to "Avoid"
- 🕐 **Freshness display** — every listing shows how recently it was rated;
  nothing in 30+ days earns a "Needs a fresh check" tag
- ✔ **Verified vs. unverified** — user-created listings are verified; seed
  data imported from [Refuge Restrooms](https://www.refugerestrooms.org)
  renders gray as unverified until a community rating confirms it
- 🗒️ **Condition reports** — timestamped notes on the current state
- ⚑ **Report listing** — flag entries that don't exist, closed permanently,
  or contain inappropriate content
- 🧭 **One-tap navigation** — deep links into Apple Maps or Google Maps
  walking directions
- ◎ **Locate me** — sorts the list by distance from your position

## Admin mode

Open the app with `?admin=1` in the URL to get the moderation queue
(⚑ Admin button in the header): review open reports, resolve them, and
edit or delete any listing.

## Data attribution

Map tiles and geodata © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors (ODbL). Seed restroom data from
[Refuge Restrooms](https://www.refugerestrooms.org).

## Running it

The whole app is a single file: `index.html`.

Restroom data is shared across all users via a `window.storage` key/value API
(available when the app runs as a hosted artifact). Outside that environment,
loading data fails gracefully and the app starts with an empty list.

Open `index.html` in a browser, or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```
