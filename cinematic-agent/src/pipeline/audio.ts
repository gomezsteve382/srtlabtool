import { existsSync } from "node:fs";
import { log } from "./log.ts";

/**
 * audio.ts — mood-tagged track selection. Picks the best-matching track for the
 * pre-gate mood from a small catalog. Tracks are expected under assets/audio/.
 * If no real file is present, returns null and the recorder renders silent video.
 */

interface Track {
  /** Path relative to the project root (or absolute). */
  file: string;
  moods: string[];
}

// A tiny catalog. Drop royalty-free .mp3s at these paths to enable scoring.
const CATALOG: Track[] = [
  { file: "assets/audio/elegant.mp3", moods: ["elegant", "minimal", "corporate"] },
  { file: "assets/audio/dramatic.mp3", moods: ["dramatic", "elegant"] },
  { file: "assets/audio/energetic.mp3", moods: ["energetic", "playful"] },
  { file: "assets/audio/warm.mp3", moods: ["warm", "playful", "elegant"] },
];

export interface AudioSelection {
  track: string;
  mood: string;
}

/**
 * Returns the chosen track path, or null if nothing in the catalog exists on
 * disk. An explicit override always wins (and is returned even if scoring would
 * pick something else), provided the file exists.
 */
export function selectAudio(mood: string, override?: string): AudioSelection | null {
  if (override) {
    if (existsSync(override)) {
      log.info(`audio: using override track ${override}`);
      return { track: override, mood };
    }
    log.warn(`audio: override ${override} not found, falling back to catalog`);
  }

  // Rank catalog entries: 2 points for exact mood match, 1 for listed mood.
  const ranked = CATALOG.map((t) => {
    let score = 0;
    if (t.moods[0] === mood) score += 2;
    if (t.moods.includes(mood)) score += 1;
    return { t, score };
  })
    .filter((r) => existsSync(r.t.file))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    log.warn(`audio: no catalog tracks found on disk — rendering silent video`);
    return null;
  }

  const chosen = ranked[0].t;
  log.info(`audio: selected ${chosen.file} for mood "${mood}"`);
  return { track: chosen.file, mood };
}
