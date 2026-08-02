# nine2two (922)

**When it's almost an emergency.**

A mobile-first, community-powered restroom finder. Users drop pins on a map for
public restrooms, rate their cleanliness (1–5 stars), tag features (free,
accessible, changing table, gender neutral, key/code required, 24 hours), and
leave condition reports so the next person knows what to expect.

## Features

- 📍 **Interactive map** (Leaflet + OpenStreetMap) with color-coded score pins
- ➕ **Add a restroom** — tap the ＋ button, then tap the map to place it
- ✦ **Cleanliness scores** — live average of community ratings, from
  "Sparkling" to "Avoid"
- 🗒️ **Condition reports** — timestamped notes on the current state
- 🧭 **One-tap navigation** — deep links into Apple Maps or Google Maps
  walking directions
- ◎ **Locate me** — sorts the list by distance from your position

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
