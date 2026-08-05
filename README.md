<img src="icons/icon-rounded-512.png" alt="nine2two icon — a toilet-paper roll forming a 9" width="96" align="left">

# nine2two (922)

**When it's almost an emergency.**

<br clear="left">


A mobile-first, community-powered restroom finder with a real shared backend
(Supabase). MVP v1.0 per [`nine2two-PRD-v1.md`](nine2two-PRD-v1.md).
Beachhead market: Hollywood / Los Angeles.

## Structure

```
index.html            App shell (PWA-ready)
css/styles.css        "Porcelain and signage" design system (PRD §6)
js/app.js             App logic — map, list, add/rate/report, admin
js/config.js          ← paste your Supabase URL + anon key here
supabase/schema.sql   Tables, Row Level Security, triggers, stats view
vendor/               Pinned copies of Leaflet 1.9.4 + supabase-js 2.111.0
                      (no CDN dependency; only map tiles load remotely)
manifest.json         PWA manifest ("Add to Home Screen")
SETUP.md              Step-by-step account setup + deploy walkthrough
prototype.html        Original single-file prototype (reference only)
```

## Features (PRD §4)

- 📍 Full-screen map (Leaflet + OpenStreetMap) centered on you, or Hollywood
  as fallback; teardrop pins color-coded by cleanliness with the score inside
- ➕ Add a restroom: tap ＋ → tap the map → name, stars, feature tags, note
- ✦ Live community cleanliness scores, "Sparkling" to "Avoid"
- 🕐 Freshness on every listing; "Needs a fresh check" after 30 days
- ✔ Verified vs. unverified: user posts are verified; imported Refuge
  Restrooms listings are gray until a community rating confirms them
- ⚑ Report listing (doesn't exist / closed / inappropriate) + admin
  moderation queue with magic-link sign-in
- 🧭 One-tap walking directions via Apple Maps or Google Maps
- 👤 No account needed to browse or rate — sign-in exists only for the admin

## Quick start

1. Follow [`SETUP.md`](SETUP.md) — create a free Supabase project, run
   `supabase/schema.sql`, paste your credentials into `js/config.js`.
2. Serve the folder: `python3 -m http.server 8000` → http://localhost:8000
3. Deploy free on GitHub Pages (SETUP.md step 8).

## Data attribution

Map tiles and geodata © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors (ODbL). Seed restroom data from
[Refuge Restrooms](https://www.refugerestrooms.org).
