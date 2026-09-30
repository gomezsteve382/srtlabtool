# Cinematic Agent

`URL in → animated scroll-driven React site + cinematic MP4 out`, in one command, fully autonomous.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and contract. This README is the quick-start.

## Pipeline

```
scrape → pre-gate → director (validate + retry) → critique loop (≤2) → audio → build → record → MP4
```

## Setup

```bash
npm install
npx playwright install chromium
export ANTHROPIC_API_KEY=sk-ant-...
ffmpeg -version            # must be present on PATH
```

## One command

```bash
npm run run -- https://goatmezmedia.com --out ./renders/goatmez
```

Output lands in `renders/<name>/`:

```
scraped.json        structured page data + screenshots
pre-gate.json       worthiness score, mood, treatment level, section roles
scene-script.json   the director's cinematic plan (the contract)
site/               built React site — open site/index.html in a browser
cinematic.mp4       the rendered film
run.log
```

### Flags

| flag | default | meaning |
|------|---------|---------|
| `--out <dir>` | `./renders/<host>` | run directory |
| `--fps <n>` | `30` | frames per second |
| `--width <n>` | `1920` | render width |
| `--height <n>` | `1080` | render height |
| `--audio <path>` | — | soundtrack override |
| `--skip a,b,c` | — | skip stages: `scrape,pre-gate,agent,critique,build,record` |

## Stage-by-stage (debugging)

```bash
npm run scrape   -- https://example.com ./renders/example/scraped.json
npm run pre-gate -- ./renders/example/scraped.json ./renders/example/pre-gate.json
npm run agent    -- ./renders/example ./renders/example/scene-script.json
npm run build
npm run record   -- --dir ./renders/example/site --script ./renders/example/scene-script.json --out ./renders/example/cinematic.mp4
```

## Live preview

```bash
npm run dev      # serves the renderer at http://localhost:5173
```

Drop a valid `scene-script.json` into `public/` (or build a run and open `renders/<name>/site/index.html`). Append `?recordMode=1` to drive the timeline programmatically via `window.__setProgress(p)`.

## Layout

| path | role |
|------|------|
| `src/shared/scene-script-schema.ts` | the contract (Zod + types), shared by pipeline and renderer |
| `src/pipeline/` | `orchestrator`, `scraper`, `pre-gate`, `agent`, `critic`, `validator`, `audio`, `recorder`, `anthropic`, `cli` |
| `src/pipeline/agent-prompt.md` | director system prompt + goatmezmedia.com few-shot |
| `src/renderer/` | `main`, `SceneRenderer`, `scenes`, `recordMode` |

## Audio

Drop royalty-free `.mp3`s at `assets/audio/{elegant,dramatic,energetic,warm}.mp3` to enable mood-matched soundtracks, or pass `--audio path.mp3`. With no tracks present, the film renders silent.

## Notes

- The live site and the MP4 come from the **same** build (record-the-live-site), not a separate render path.
- `ANTHROPIC_API_KEY` is used server-side only and never reaches the `site/` bundle.
- Model: `claude-opus-4-8` with adaptive thinking (`src/pipeline/anthropic.ts`).
