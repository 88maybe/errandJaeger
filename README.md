# errandJaeger

A mobile-first web app that turns errand-running in Boston into a calmer **bingo walk**.

Pick places on a map (or just say what you need), get one simple plan with real train times, and follow it one step at a time. A bingo card (optional) and a gentle profile with ranks and badges make small outings feel like progress.

Built at BostonHacks 2026 (Boundless Boston track). See [PLAN.md](PLAN.md) for the plan and milestones.

## Who it's for

Neurodivergent riders and walkers (ADHD, autism) who find planning tiring: juggling train times, estimating effort, and deciding what to do next.

- **Calmer mode**: shorter walks, fewest changes, and **one simple step at a time**. It never promises "quiet", only calmer.
- **Stim mode**: on = livelier map, brighter accents, side quests; off = fewer markers, muted colours, fades only, errands first.
- Dark, high-contrast design built for a 375px phone screen, big tap targets, plain language. The phone's "reduce motion" setting turns all animation off.
- Every time says where it comes from: **Live** (MBTA predictions), **Scheduled** (MBTA timetable) or **estimate**.

## How it works

- **Real data and code do the facts.** Places come from OpenStreetMap (and a small hand-written list). The planner, the subway router and all time maths are plain code, in Boston time.
- **AI only helps with words** (Google Gemini, server side): it can read a typed request or a "brain dump" list into choices for you to confirm, and make bingo squares and calm steps friendlier. It never invents places or times; everything it returns is checked, and every AI feature has a non-AI fallback.
- Saved in your browser, no account. If a database is set up (`DATABASE_URL`), finished outings and stats are also saved there under an anonymous random device id.

## Run it

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then add your own keys (all optional, see below)
npm run dev
```

Open http://localhost:3000. On a phone on the same Wi-Fi, use your computer's local IP address with port 3000. To install it like an app, use your browser's "Add to Home Screen".

Other commands:

```bash
npm run build           # production build
npm run check:planner   # planner, router, hours parser and directions checks
npm run check:db        # checks the database SQL on an in-memory Postgres (no server needed)
npm run sync:terminals  # refresh line terminals, station positions and entrances from the MBTA
npm run snapshot:places # save real OpenStreetMap places for the Boston core (fallback for the map search)
npm run spike:mbta      # read-only look at what the MBTA API offers
```

## Environment variables

Set these in `.env.local`. **Never commit that file** (it is git-ignored). `.env.example` lists the names with no values. All are used on the server only and never sent to the browser.

| Name | Needed for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | AI wording, reading requests and brain dumps | Optional. Without it the app uses simple keyword matching and plain text. |
| `GEMINI_MODEL` | Choosing a model | Optional. Default `gemini-3.5-flash-lite`. |
| `MBTA_API_KEY` | Train times, live predictions, alerts | Optional. Without it the MBTA allows about 20 requests a minute; results are cached briefly. |
| `DATABASE_URL` | Saving outings and stats in Postgres (e.g. Tiger Data) | Optional. Tables are created on first use. Without it, or if it fails, the browser copy is used. `sslmode=require` means encrypted without checking the certificate chain, as in standard Postgres tools; use `verify-full` to check it. |
| `GEOAPIFY_API_KEY` | Not used yet | Reserved for a future place-search fallback. The app works without it. |

## Data sources and credits

- **Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors**, available under the ODbL. Map tiles: [OpenFreeMap](https://openfreemap.org) (OpenMapTiles), with plain OpenStreetMap tiles as a fallback.
- **Place search**: OpenStreetMap via public Overpass API servers; `data/osm-snapshot.json` is a saved copy (also © OpenStreetMap contributors, ODbL).
- **Walking and driving routes**: [OSRM](https://project-osrm.org) public servers (router.project-osrm.org, routing.openstreetmap.de by FOSSGIS).
- **Train data**: [MBTA V3 API](https://www.mbta.com/developers/v3-api) (schedules, predictions, alerts, stations). The app is not affiliated with or endorsed by the MBTA.
- **AI**: Google Gemini (wording only).

## Honest limits

- **Subway only**: Green (B, C, D, E), Orange, Red and Blue Lines, central parts only. **No buses**, commuter rail or ferries yet.
- The subway map, stop order and walk links between nearby stations are hand-built (checked against the MBTA by `npm run sync:terminals`).
- Walking times come from OSRM where available, otherwise from straight-line distance. They are **estimates**, and are labelled so. Driving times have no traffic and no parking.
- Opening hours come from OpenStreetMap or our own list and are often missing or out of date: the app says "hours unknown" and asks you to check.
- Public map and routing servers have usage limits; when they are busy the app falls back to the saved snapshot or to estimates.
- Only works around Greater Boston.

## Project map

- `app/` pages (`/` map home, `/plan`, `/go` directions, `/bingo`, `/stats` profile, `/done`) and API routes (`app/api/`)
- `lib/planner/` the planner (plain code, no AI)
- `lib/transit/` the hand-built subway map, router, MBTA helpers
- `lib/nearby/`, `lib/osrm/`, `lib/directions/` place search, routing, directions
- `lib/ai/` Gemini helper, output checks, and the non-AI fallbacks
- `lib/db/` optional Postgres storage; `lib/storage.ts` the one place the app saves things
- `data/` places (hand-written list and OpenStreetMap snapshot)
- `scripts/` developer scripts

## Notes

Fresh code written during BostonHacks 2026. No secrets are committed.
