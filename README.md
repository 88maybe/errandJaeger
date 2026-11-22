# errandJaeger

A mobile-first web app that turns Boston errands into a "bingo walk", designed with ADHD/autistic users in mind. Pick what you need today, and get one consolidated route plan (transit timing, walks, directions, last-ride warnings) plus a calmer, one-step-at-a-time mode.

Built at BostonHacks 2026 (Boundless Boston track). See [PLAN.md](PLAN.md) for the plan.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your own keys
npm run dev
```

Open http://localhost:3000. On a phone on the same Wi-Fi, use your computer's local IP address with port 3000.

## Keys (never commit these)

Put them in `.env.local`:
- `GEMINI_API_KEY`
- `MBTA_API_KEY`
- `DATABASE_URL`

## Status

M0 scaffold done. More coming.
