# errandJaeger

A mobile-friendly web app that turns errand-running in Boston into a **bingo walk**.

You pick what you need today (groceries, a snack, something to do, a favorite spot), where you are starting, and when. errandJaeger builds one simple plan with time estimates, then shows it as a 3x3 bingo card you tick off. Finishing a line or the whole card gets a small celebration, and your outings build a gentle streak.

Built at BostonHacks 2026 (Boundless Boston track). See [PLAN.md](PLAN.md) for the plan and milestones.

## Who it's for

Neurodivergent riders and walkers (ADHD, autism) who find planning tiring: juggling bus times, estimating effort, and deciding what to do next. The app tries to put what you need in one place.

- **Calmer mode** picks shorter walks and shows **one simple step at a time** with a big Next button. It never promises "quiet", only calmer.
- Plain language, large tap targets, high contrast, and no autoplay animation (it respects the "reduce motion" setting).
- Every time is an estimate, and the app says so. Hours may vary, so check before you go.

## How it works

- **Real data and code do the facts.** Places come from a hand-written list (`data/places.json`) and the planner does the opening-hours and walking-time math in Boston time.
- **AI only helps with words** (Google Gemini, server-side): it can read "Tell me what you need today" to prefill the form, and make bingo squares and calm-mode steps friendlier. It never invents places or times. Anything it returns is checked, and every AI feature has a non-AI fallback, so the app works with no key at all.
- Everything is saved in your browser (no account needed).

Train rides (Green and Orange Lines near the launch area) use a small hand-built map. Departure times, last-train warnings and alerts come from the real MBTA schedule (server side); ride time is an estimate. If the MBTA cannot be reached, the plan still works and says so. Live trip mode refreshes MBTA predictions every 30 seconds, and "I'm running late" re-times the rest of the plan. Every time shows a Live, Scheduled or Estimate chip. Not built yet: a database. See PLAN.md.

## Run it

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then add your own keys (all optional, see below)
npm run dev
```

Open http://localhost:3000. On a phone on the same Wi-Fi, use your computer's local IP address with port 3000.

Other commands:

```bash
npm run build           # production build
npm run check:planner   # prints sample plans from the planner
npm run spike:mbta      # read-only look at what the MBTA API offers (no app changes)
```

## Environment variables

Set these in `.env.local`. **Never commit that file** (it is already git-ignored). `.env.example` lists the names with no values.

| Name | Needed for | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | The AI features | Optional. Without it the app uses simple keyword matching and plain text. Used on the server only, never sent to the browser. |
| `GEMINI_MODEL` | Choosing a model | Optional. Default is `gemini-3.5-flash-lite`. |
| `MBTA_API_KEY` | Train times and alerts | Optional. Used on the server only. Without it the MBTA allows about 20 requests a minute, and results are cached for a few minutes. |
| `DATABASE_URL` | Later (Tiger Data) | Not used yet. |

## Project map

- `app/` pages (`/`, `/plan`, `/bingo`, `/stats`, `/done`) and the AI API routes (`app/api/ai/`)
- `lib/planner/` the route planner (plain code, no AI)
- `lib/transit/` the hand-built subway map and route finder (plain code)
- `lib/ai/` Gemini helper, output checks, and the non-AI fallback
- `lib/storage.ts` the one place the app saves things
- `data/places.json` the places (hours are from memory: spot-check them)
- `scripts/` developer scripts

## Notes

Fresh code written during BostonHacks 2026. No secrets are committed.
