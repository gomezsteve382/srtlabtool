import { complete, extractJSON } from "./anthropic.ts";
import type { ImageInput } from "./anthropic.ts";
import type { SceneScript } from "../shared/scene-script-schema.ts";
import { log } from "./log.ts";

/**
 * critic.ts — a Claude critic. Looks at preview frames captured from the
 * rendered build and returns a verdict: ship | ship_with_notes | revise.
 * On revise, the structured feedback goes back to the director.
 */

export type Verdict = "ship" | "ship_with_notes" | "revise";

export interface Critique {
  verdict: Verdict;
  /** Actionable feedback for the director (used on revise / ship_with_notes). */
  feedback: string;
  /** 0..100 overall craft score. */
  score: number;
}

const SYSTEM = `You are the Critic in a cinematic website-to-film pipeline. You are shown
several still frames sampled across a scroll-driven film generated from a website, plus the
scene script that produced them. Judge it like a demanding art director:

- composition, contrast, and legibility of text over imagery
- pacing and camera restraint (no jarring jumps, no empty dead frames)
- whether depth/parallax reads as intentional
- whether the palette and mood are coherent

Return ONLY this JSON, no prose, no code fences:
{
  "verdict": "ship" | "ship_with_notes" | "revise",
  "score": number,        // 0-100
  "feedback": string      // concrete, scene-by-scene where useful; empty allowed when "ship"
}

Use "revise" only for real problems the director can fix in the scene script
(timing, camera values, palette, effect intensity, copy, asset choice, scene order).
Do not ask for things outside the scene-script contract.`;

export interface CritiqueOptions {
  script: SceneScript;
  /** PNG frames sampled across the film. */
  frames: ImageInput[];
}

export async function critique(opts: CritiqueOptions): Promise<Critique> {
  log.step(`critic: evaluating ${opts.frames.length} preview frames`);

  const prompt = `SCENE SCRIPT:
\`\`\`json
${JSON.stringify(opts.script, null, 2)}
\`\`\`

The ${opts.frames.length} attached images are frames sampled in order across the film. Judge it.`;

  const text = await complete({
    system: SYSTEM,
    prompt,
    images: opts.frames,
    maxTokens: 3000,
    effort: "medium",
  });

  const raw = extractJSON<Partial<Critique>>(text);
  const verdict: Verdict =
    raw.verdict === "ship" || raw.verdict === "ship_with_notes" || raw.verdict === "revise"
      ? raw.verdict
      : "ship_with_notes";

  const result: Critique = {
    verdict,
    score: Math.max(0, Math.min(100, Math.round(raw.score ?? 70))),
    feedback: raw.feedback ?? "",
  };
  log.info(`critic: verdict=${result.verdict} score=${result.score}`);
  return result;
}
