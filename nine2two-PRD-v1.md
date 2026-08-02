# PRD: nine2two (922) — MVP v1.0

**Product:** nine2two — community-rated restroom finder
**Tagline:** "When it's almost an emergency"
**Visual shorthand:** "922" (app icon, map pins)
**Platform:** Mobile-first responsive web app (PWA-ready)
**Beachhead market:** Hollywood / Los Angeles, CA
**Owner:** Lamarr · **PM:** Claude
**Version:** 1.0 — MVP scope only

---

## 1. Problem

LA has roughly 14 free-standing public restrooms for ~4 million people. Tourists, delivery and truck drivers, rideshare drivers, and pedestrians in dense corridors like Hollywood Blvd have no reliable way to find a restroom that is (a) actually open, (b) actually usable, and (c) actually clean *right now*. Existing apps (Flush, SitOrSquat, Toilet Finder, Restmap) have big databases but stale, unaccountable data.

## 2. Product Vision (one sentence)

The restroom app people trust because every listing is either verified by a real local or clearly labeled as unverified — starting with the best restroom map of Hollywood in existence.

## 3. Target Users (MVP)

1. **Pedestrians/tourists in Hollywood** — need the nearest decent restroom immediately.
2. **Drivers (truck, delivery, rideshare)** — need reliable stops along routes; founder is one of them.
3. **Contributors** — locals willing to add/rate restrooms (initially: the founder + early community).

## 4. MVP Feature Requirements

### 4.1 Map (core screen)
- Full-screen interactive map, centered on user's location (with permission) or Hollywood center (34.1016, -118.3267) as fallback.
- Restroom pins color-coded by average cleanliness score: green ≥4.0, yellow 2.5–3.9, red <2.5, gray = unrated/unverified.
- Pin displays the numeric score (e.g., "4.2") inside the marker.
- "Locate me" button re-centers on user.
- Bottom panel lists restrooms sorted by distance from user, each row showing: name, distance, score badge, score word (Sparkling / Clean / Decent / Rough / Avoid), rating count, feature tags.

### 4.2 Restroom detail view
- Name, average score (large badge), score word, distance, feature tags.
- **Navigate button** — opens device-native directions: Google Maps URL (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=walking`) on Android/desktop, Apple Maps (`https://maps.apple.com/?daddr=LAT,LNG&dirflg=w`) on iOS.
- Recent reports list: stars, note, relative timestamp ("2h ago").
- Inline rating form: 1–5 stars (required) + optional note (200 char max).

### 4.3 Add a restroom
- Flow: tap "+" → tap map to drop pin → form.
- Form fields:
  - Name/location (required, 60 char max) — e.g., "Central Library, 2nd floor"
  - Cleanliness now: 1–5 stars (required)
  - Feature tags (multi-select): Free · Accessible ♿ · Changing table · Gender neutral · Needs key/code · 24 hours
  - Condition note (optional, 200 char max)
- On save: pin appears immediately; the initial rating counts as the first review.

### 4.4 Freshness display
- Every score shows the age of its most recent rating ("rated 3h ago" / "last rated 12d ago").
- Listings with no rating in 30+ days display a "Needs a fresh check" tag. (No score decay math in MVP — display-only.)

### 4.5 Verified vs. Unverified layer
- Every listing has a `verified` boolean.
- User-created listings = verified. Imported listings (Refuge Restrooms / OpenStreetMap seed data) = unverified until a user submits a rating on them, which flips them to verified.
- Unverified pins render gray with a "Be the first to confirm" label in detail view.
- Attribution line in app footer/about screen for OpenStreetMap (ODbL) and Refuge Restrooms data.

### 4.6 Accounts (minimal)
- Anonymous browsing and rating allowed in MVP (lowest friction — critical for "almost an emergency" use case).
- Optional lightweight sign-in (email) only if the build platform requires it for spam control; never require sign-in to *view* the map.

### 4.7 Moderation (minimal but required)
- "Report listing" button on every detail view (reasons: doesn't exist / closed permanently / inappropriate content).
- Reported items flagged in a simple admin view for the owner to hide/delete.
- Admin ability to edit/delete any listing.

## 5. Data Model

**Restroom**
- id, name, lat, lng, tags[], verified (bool), source ("user" | "osm" | "refuge"), createdAt

**Review**
- id, restroomId, stars (1–5), note (≤200 chars), createdAt

**Report**
- id, restroomId, reason, createdAt, resolved (bool)

Derived (never stored): average score, rating count, last-rated age, distance from user.

## 6. Design Spec

Follow the existing prototype's visual system ("porcelain and signage"):
- Background `#F7F9FA` (porcelain), cards `#FFFFFF` with `#E3E9EC` borders
- Primary `#0E6E73` (deep aqua), accent `#FFC531` (signal yellow), text `#1C2B2D`
- Score colors: `#2E9E5B` (clean), `#FFC531` (decent), `#C94F3D` (avoid)
- Header: white "922" square badge + "nine2two" wordmark + tagline "WHEN IT'S ALMOST AN EMERGENCY"
- Rounded (12–16px radii), pill-shaped tags, teardrop map pins with score numeral
- Big tap targets; one-handed use assumed; a stressed user must reach "Navigate" in ≤2 taps from opening the app

## 7. Non-Goals (explicitly out of MVP)

- No photos (moderation burden too high for v1)
- No comments/threads — ratings + short notes only
- No user profiles, karma, or gamification
- No push notifications
- No business/"verified clean" badge portal (Phase 5 revenue feature)
- No offline mode
- No native App Store/Play Store builds (mobile web/PWA first)
- No score-decay algorithm (display freshness only)

## 8. Success Criteria (soft launch, Phase 3)

- 75+ verified Hollywood listings live at launch
- A first-time user can find and navigate to a restroom in under 30 seconds
- ≥25 ratings submitted by non-founder users in the first month
- ≥5 unverified (imported) listings flipped to verified by community ratings

## 9. Build Notes for Base44 (credit-conservation strategy)

Prompt in this order, one feature per prompt, referencing this PRD section by number:

1. **Prompt 1 — skeleton:** App shell + map screen per §4.1 + data model per §5. Include the design spec (§6) in this first prompt so styling is right from the start.
2. **Prompt 2 — add flow:** §4.3 exactly.
3. **Prompt 3 — detail + rating:** §4.2.
4. **Prompt 4 — freshness + verified layer:** §4.4 + §4.5.
5. **Prompt 5 — report/moderation:** §4.7.

Rules: paste requirements verbatim rather than describing loosely; fix one bug per prompt; stop and reassess if the map itself (pins, geolocation, tap-to-place) isn't working by the end of the free tier — that's the known Base44 weak spot and the no-go signal that moves the build to Claude Code instead.

## 10. Decision Gate

After the free-tier test: **map + pins + add flow working → upgrade to Builder plan and continue. Map broken or flaky → stop, keep the PRD, build with Claude Code.** Either way, this document is the spec.
