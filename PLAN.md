# errandJaeger - PLAN.md

## Goal
Mobile-first web app for BostonHacks 2026 (track: Boundless Boston). Solo build, limited hours: runnable at every milestone.
User picks a hitlist for today (any of: grocery, snack, activity/sightseeing, new route, a favorite spot), a start time, and whether to loop back.
- Normal mode: a 3x3 "bingo walk" to tick off, with a small reward (stats/streak).
- Calm (low-stimulation) mode: fewer transfers, off-peak, short walks, ONE simple step at a time, AND a consolidated route plan so the user never juggles Google + transit apps: transit timing, walks between trains/buses, which direction to walk, which line/direction/platform to board, leave-by, be-back-by, last-ride warning.
Designed from a neurodivergent (ADHD/autism) perspective: planning fatigue, brain fog on execution.

## Hard rules
- Fresh code only. Never commit secrets. Keys in .env.local (GEMINI_API_KEY, MBTA_API_KEY, DATABASE_URL); provide .env.example.
- User reviews and pushes. Do NOT commit or push. Before coding, explain which files you'll change and why; wait for "go". Small chunks. After each: how to run, what to see, a 3-line explanation.
- Real data and code do facts and time math. AI never invents places or times. Every Gemini call has a non-AI fallback.
- Say "calmer," never "quiet." Label estimates as estimates.
- Timezone: America/New_York.
- Cursor vs Claude Code for the SpaceXSI challenge is the user's open decision. Don't assume; ask. If Cursor is too much, Claude Code is main builder.

## Stack
- Next.js (App Router), API routes as backend. Deploy on Vercel at M0.
- Gemini API (current Flash-class model; verify name in docs), server-side only.
- MBTA V3 API (api-v3.mbta.com; verify endpoints).
- Places: data/places.json, ~30 real places around Kenmore/Back Bay/Downtown with name, category, lat, lng, nearestStop, weekly hours, priceLevel, busyTimes estimate. Spot-check hours.
- Storage behind ONE module (lib/storage): localStorage first, Tiger Data (Postgres) at M4. No auth.

## Core logic (lib/planner, plain code, no AI)
1. Input: needs[], startTime, loop, mode (normal|calm).
2. Filter places by category and open at arrival time.
3. Order stops (nearest-neighbor); compute legs and total time; add return leg if loop.
4. Compute leaveBy/backBy. Check last departure for the return route; flag WARNING if backBy is within 45 min of it or after.
5. Calm mode: fewer transfers, off-peak, shorter walks.
RoutePlan legs: {type: walk|transit, from, to, startTime, durationMin, instruction}
- walk: direction in plain words
- transit: line, board at (stop + platform if data exists), direction as terminal ("toward Alewife"), departure time (live if available), get-off stop, transfer note
Show one-screen overview (all legs, leave by, back by) AND a one-step-at-a-time view.

## Route data (decide at M3 spike, 30-min timebox)
Option A: Google Directions API (transit + walking) if a Maps key exists.
Option B: MBTA V3 stops/routes/predictions + small hand-built station graph for the launch area + a free foot-routing service for walking steps.
Where platform info is missing, show direction by destination terminal. Ask the user which option before building.

## Gemini (lib/ai)
parseRequest(text) -> structured needs (validated JSON). writeBingo(plan) -> 9 squares. writeSteps(plan, mode) -> short plain steps. Fallback to templates on failure.

## UI
Mobile-first, big tap targets, high contrast, calm palette, no autoplay animation (respect reduced motion), plain language. Screens: Home -> Plan -> Bingo card (tap to mark done) -> Done/stats.

## Milestones (each ends runnable; user commits)
M0 scaffold, .env.example, run locally, deploy to Vercel.
M1 WORKING DEMO: form -> planner (places.json, no AI, no live T) -> bingo card, tick off, saved locally.
M2 Gemini (parse, bingo text, steps) with fallbacks; calm mode.
M3a real transit + walking legs, one-screen overview, calm step view.
M3b live departures, last-ride warning, alerts banner.
M4 Tiger Data via storage module (45-min timebox; skip if stuck); stats + streak.
M5 polish, README, demo script.
Cut order if short: domain, Tiger Data, alerts banner, surprise square. Never cut M1, M3a, or the last-ride warning.

## Status (user ticks)
[x] M0  [ ] M1  [ ] M2  [ ] M3a  [ ] M3b  [ ] M4  [ ] M5