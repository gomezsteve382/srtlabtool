import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scrape } from "./scraper.ts";
import { preGate } from "./pre-gate.ts";
import { direct } from "./agent.ts";
import { critique } from "./critic.ts";
import { selectAudio } from "./audio.ts";
import { record, capturePreviewFrames } from "./recorder.ts";
import { setRunLog, log } from "./log.ts";
import type { ScrapedSite, PreGate } from "../shared/scraped-types.ts";
import type { SceneScript } from "../shared/scene-script-schema.ts";

/**
 * orchestrator.ts — end-to-end runner. URL → MP4 in one call.
 *
 * scrape → pre-gate → director (validate + retry) → critique loop (≤2) → audio
 * → build → record → MP4
 */

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type Stage = "scrape" | "pre-gate" | "agent" | "critique" | "build" | "record";

export interface RunOptions {
  url: string;
  outDir: string;
  fps?: number;
  width?: number;
  height?: number;
  audio?: string;
  /** Stages to skip (reusing prior artifacts). */
  skip?: Stage[];
  /** Max critique rounds. */
  maxCritiqueRounds?: number;
}

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Vite build into PROJECT_ROOT/dist, then copy into <outDir>/site with the script. */
function buildSite(outDir: string, scriptPath: string): string {
  log.step("build: vite build");
  const res = spawnSync("npx", ["vite", "build"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`vite build failed (exit ${res.status})`);
  }
  const dist = join(PROJECT_ROOT, "dist");
  const site = join(outDir, "site");
  mkdirSync(site, { recursive: true });
  cpSync(dist, site, { recursive: true });
  // The renderer fetches ./scene-script.json at runtime — place it next to index.html.
  cpSync(scriptPath, join(site, "scene-script.json"));
  log.info(`built site → ${site}`);
  return site;
}

export async function run(opts: RunOptions): Promise<{ mp4: string; outDir: string }> {
  const outDir = resolve(opts.outDir);
  mkdirSync(outDir, { recursive: true });
  setRunLog(join(outDir, "run.log"));

  const skip = new Set(opts.skip ?? []);
  const scrapedPath = join(outDir, "scraped.json");
  const preGatePath = join(outDir, "pre-gate.json");
  const scriptPath = join(outDir, "scene-script.json");
  const mp4Path = join(outDir, "cinematic.mp4");

  log.info(`=== Cinematic Agent: ${opts.url} → ${outDir} ===`);

  // 1. scrape
  let scraped: ScrapedSite;
  if (skip.has("scrape") && existsSync(scrapedPath)) {
    scraped = readJSON<ScrapedSite>(scrapedPath);
    log.info("skip: reusing scraped.json");
  } else {
    scraped = await scrape({ url: opts.url, outDir, width: opts.width, height: opts.height });
    writeFileSync(scrapedPath, JSON.stringify(scraped, null, 2));
  }

  // 2. pre-gate
  let gate: PreGate;
  if (skip.has("pre-gate") && existsSync(preGatePath)) {
    gate = readJSON<PreGate>(preGatePath);
    log.info("skip: reusing pre-gate.json");
  } else {
    gate = await preGate(scraped, outDir);
    writeFileSync(preGatePath, JSON.stringify(gate, null, 2));
  }

  if (gate.treatment === "skip") {
    log.warn(`pre-gate returned treatment="skip" (score ${gate.score}). Proceeding anyway with minimal expectations.`);
  }

  // 3. director (validate + retry)
  let script: SceneScript;
  if (skip.has("agent") && existsSync(scriptPath)) {
    script = readJSON<SceneScript>(scriptPath);
    log.info("skip: reusing scene-script.json");
  } else {
    script = await direct({ scraped, preGate: gate });
    writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  }

  // attach the selected audio to the script meta (for the renderer/record)
  const audioSel = selectAudio(gate.mood, opts.audio);
  if (audioSel) {
    script.audio = { track: audioSel.track, mood: audioSel.mood };
    writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  }

  // 4. build
  let site = join(outDir, "site");
  if (skip.has("build") && existsSync(join(site, "index.html"))) {
    cpSync(scriptPath, join(site, "scene-script.json"));
    log.info("skip: reusing built site (refreshed scene-script.json)");
  } else {
    site = buildSite(outDir, scriptPath);
  }

  // 5. critique loop (≤ N rounds)
  const maxRounds = opts.maxCritiqueRounds ?? 2;
  if (!skip.has("critique")) {
    for (let round = 1; round <= maxRounds; round++) {
      log.step(`critique round ${round}/${maxRounds}`);
      const frames = await capturePreviewFrames({
        dir: site,
        width: opts.width,
        height: opts.height,
        count: 5,
      });
      const verdict = await critique({ script, frames });
      writeFileSync(join(outDir, `critique-${round}.json`), JSON.stringify(verdict, null, 2));

      if (verdict.verdict !== "revise") {
        log.info(`critique: ${verdict.verdict} — shipping`);
        break;
      }
      if (round === maxRounds) {
        log.warn("critique: max rounds reached — shipping current cut");
        break;
      }

      log.step("critique: revising via director");
      script = await direct({
        scraped,
        preGate: gate,
        criticFeedback: verdict.feedback,
        priorScript: script,
      });
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      if (audioSel) {
        script.audio = { track: audioSel.track, mood: audioSel.mood };
        writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      }
      // renderer reads scene-script.json at runtime; just refresh it (no rebuild)
      cpSync(scriptPath, join(site, "scene-script.json"));
    }
  } else {
    log.info("skip: critique");
  }

  // 6. record
  if (skip.has("record") && existsSync(mp4Path)) {
    log.info("skip: reusing cinematic.mp4");
  } else {
    await record({
      script,
      dir: site,
      out: mp4Path,
      fps: opts.fps,
      width: opts.width,
      height: opts.height,
      audio: audioSel?.track,
    });
  }

  log.info(`=== done → ${mp4Path} ===`);
  return { mp4: mp4Path, outDir };
}
