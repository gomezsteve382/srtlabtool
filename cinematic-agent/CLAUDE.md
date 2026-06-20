# Cinematic Agent — `CLAUDE.md`

> Context file for Claude Code. This project takes any website URL and produces (a) a cinematic, scroll-driven animated version of the site and (b) an MP4 video render of that experience — full "Pixar treatment." Read this top to bottom before touching code.

---

## Mission

`URL in → animated React site + cinematic MP4 out`, in one command, fully autonomous.

The system is an agent pipeline: it scrapes a site, has an AI director decide the cinematic plan, generates a renderable React build from that plan, then records the build to video. Benchmark/reference site: **goatmezmedia.com** (used as the few-shot example in the director prompt and as the regression baseline).

---

## The Pipeline (current = v2)

```
scrape → pre-gate → director (validate + retry) → critique loop (≤2 rounds) → audio → build → record → MP4
```

1. **scrape** — Playwright loads the URL, extracts structured page data (sections, copy, images, palette hints) + screenshots → `scraped.json`.
2. **pre-gate** — a Claude call scores whether the site is worth the treatment and picks a mood. Emits a **treatment level**: `full` | `minimal` | `skip`. Section role classification (hero/feature/testimonial/CTA) is done by the agent here, **not** regex.
3. **director (agent)** — Claude turns the scrape into a structured **scene script** (JSON). Wrapped in a Zod validation + retry loop; invalid output is fed back with the validation error until it passes.
4. **critique loop** — a critic Claude evaluates rendered preview frames and returns a verdict: `ship` | `ship_with_notes` | `revise`. On `revise`, structured feedback goes back to the director. Max 2 rounds, then it ships whatever it has.
5. **audio** — selects a track from a mood-tagged catalog matching the pre-gate mood.
6. **build** — Vite build of the renderer consuming `scene-script.json`.
7. **record** — Playwright loads the built site in `?recordMode=1`, drives scroll deterministically, captures frames, pipes them to ffmpeg → `cinematic.mp4`.

---

## Scene Script — the contract

`scene-script.json` is the typed bridge between the director's *narrative intent* and the renderer's *renderable instructions*. It is the single source of truth between agent and renderer. Schema lives in `scene-script-schema.ts`, validated at runtime with **Zod** including **cross-field consistency checks** (e.g. duration vs. scroll distance, referenced assets must exist).

**v2 scene types (4 — do not reintroduce the old 11):**
- `hero`
- `parallax_reveal`
- `stats_grid`
- `cta`

Each scene carries: type, copy/content, mood/palette, camera/transition choreography, effects, and timing.

---

## Tech Stack

- **GSAP + ScrollTrigger** — scroll-driven master timeline. The backbone.
- **Lenis** — smooth scroll for the live site. **Bypassed in record mode** (record mode drives scroll programmatically for frame-perfect determinism).
- **CSS perspective + `preserve-3d` / `translateZ`** — depth and parallax. **R3F was removed in v2** — do not add React Three Fiber back unless explicitly asked; real CSS perspective replaced it.
- **postprocessing-style effects** via CSS/shader-lite — bloom/glow/DoF feel without the 3D engine.
- **Framer Motion** — UI-level micro animations.
- **Tailwind** — styling layer.
- **Playwright** — both scraping and frame capture.
- **ffmpeg** — encoding (frames piped via stdin).
- **Vite + React + TypeScript** — renderer app.
- **Anthropic API** — pre-gate, director, and critic stages.

---

## Record mode (critical detail)

- Activated by query param: `?recordMode=1`.
- Lenis is disabled; scroll is set deterministically.
- The renderer exposes `window.__setProgress(p)` (p = 0..1) so the recorder can step the timeline frame by frame.
- `SCROLL_PX_PER_SEC = 320` — the constant mapping scene duration to scroll distance. Keep timing math consistent with this.

---

## File map (target structure)

| File                      | Role                                                |
|---------------------------|-----------------------------------------------------|
| `orchestrator.ts`         | End-to-end runner — `URL → MP4` in one command      |
| `scraper.ts`              | Playwright-based site analysis → `scraped.json`     |
| `pre-gate.ts`             | Claude call: worthiness score, mood, treatment level, section roles |
| `agent.ts`                | Claude API wrapper (director) with retry/feedback loop |
| `agent-prompt.md`         | Director system prompt — mood rules, depth rules, ranges, goatmezmedia.com few-shot |
| `critic.ts`               | Claude critic — evaluates frames, returns verdict   |
| `validator.ts`            | Zod schema + quality gate + asset healing           |
| `scene-script-schema.ts`  | TypeScript types — the contract                     |
| `audio.ts`                | Mood-tagged track selection                         |
| `SceneRenderer.tsx`       | Top-level React renderer with scene dispatch        |
| `scenes.tsx`              | The 4 scene components (hero, parallax_reveal, stats_grid, cta) |
| `recordMode.ts`           | Record-mode hooks (`__setProgress`, Lenis bypass)   |
| `recorder.ts`             | Playwright frame capture → ffmpeg pipe              |
| `main.tsx`                | Vite entry — fetches `scene-script.json` and mounts |

> Note: v1 had `scenes.tsx` with 11 scene types and a `Scene3DFrame.tsx` (R3F). v2 superseded both. Current state = 4 scenes, no R3F.

> Actual on-disk layout in this repo: pipeline code lives under `src/pipeline/`, the React renderer under `src/renderer/`, and the shared contract under `src/shared/`. The roles above map 1:1 onto those files.

---

## Output per run

```
renders/<name>/
├── scraped.json           ← structured page data + screenshots
├── pre-gate.json          ← worthiness, mood, treatment level, section roles
├── scene-script.json      ← the director's cinematic plan
├── site/                  ← built React site (open in browser)
├── cinematic.mp4          ← rendered video
└── run.log
```

---

## Commands

```bash
# setup
npm install
npx playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...
ffmpeg -version            # must be present

# one command, fully autonomous
npm run run -- https://example.com --out ./renders/example

# flags
--fps 30
--width 1920 --height 1080
--audio ./track.mp3
--skip scrape,agent        # skip stages on rerun

# stage-by-stage (debugging)
npm run scrape -- https://example.com ./renders/example/scraped.json
npm run agent  -- ./renders/example ./renders/example/scene-script.json
npm run build
npm run record -- --dir ./renders/example/site --script ./renders/example/scene-script.json --out ./renders/example/cinematic.mp4
```

---

## Anthropic API usage

- Three model touchpoints: **pre-gate**, **director**, **critic**.
- Server-side only — `ANTHROPIC_API_KEY` from env, never in any client bundle or `site/` output.
- Director and critic both expect strict JSON; strip code fences before parsing and validate with Zod before use.
- The retry loop re-prompts the director with the Zod error text on invalid output.
- Model: `claude-opus-4-8` with adaptive thinking. See `src/pipeline/anthropic.ts`.

---

## Conventions / ground rules

- TypeScript throughout. Strict types on the scene-script contract — that file is load-bearing.
- Don't reintroduce R3F or the 11-scene-type sprawl; v2 deliberately simplified.
- Keep the live site and the video coming from the **same codebase** (record-the-live-site approach, not a separate Remotion render path).
- Tailwind for styling.
- Autonomous execution preferred — make reasonable architectural calls and build rather than stopping to ask at every step.
- All shell steps explicit and copy-pasteable; longer scripts written as commented, notebook-style files.

---

## Build order (if rebuilding from scratch in Claude Code)

1. `scene-script-schema.ts` + `validator.ts` (the contract first).
2. `scraper.ts` → produces real `scraped.json` from one test URL.
3. `agent.ts` + `agent-prompt.md` → director emits a valid scene script (retry loop wired).
4. `SceneRenderer.tsx` + `scenes.tsx` + `main.tsx` → renders the 4 scene types from a scene script.
5. `recordMode.ts` + `recorder.ts` → frame capture → ffmpeg → MP4.
6. `orchestrator.ts` → wire end-to-end, one command, on goatmezmedia.com.
7. `pre-gate.ts`, `critic.ts`, `audio.ts` → add the worthiness gate, critique loop, and soundtrack.
8. Tune the goatmezmedia.com reference scene-script as the regression baseline.
