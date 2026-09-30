import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { complete, extractJSON } from "./anthropic.ts";
import { validateSceneScript } from "./validator.ts";
import type { SceneScript } from "../shared/scene-script-schema.ts";
import type { ScrapedSite, PreGate } from "../shared/scraped-types.ts";
import { log } from "./log.ts";

/**
 * agent.ts — the Director. Turns scraped.json (+ pre-gate) into a validated
 * scene-script.json, wrapped in a Zod validation + retry loop. Invalid output
 * is fed back to the model with the exact validation error until it passes.
 *
 * Also accepts optional critic feedback to revise an existing script.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(HERE, "agent-prompt.md");

function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

function buildDirectorInput(scraped: ScrapedSite, preGate: PreGate): string {
  // Merge pre-gate section roles into the scraped sections for the director.
  const roleByIndex = new Map(preGate.sectionRoles.map((r) => [r.index, r.role]));
  const sections = scraped.sections.map((s) => ({
    index: s.index,
    role: roleByIndex.get(s.index) ?? "content",
    heading: s.heading,
    text: s.text.slice(0, 400),
  }));

  return `MOOD (from pre-gate): ${preGate.mood}
TREATMENT: ${preGate.treatment}
SOURCE URL: ${scraped.url}
TITLE: ${scraped.title}
DESCRIPTION: ${scraped.description}
PALETTE HINTS: ${scraped.paletteHints.join(", ")}
HEADINGS: ${scraped.headings.join(" | ")}

AVAILABLE IMAGES (use these exact urls for assets, or omit):
${JSON.stringify(scraped.images.map((i, n) => ({ suggestedId: `img-${n}`, url: i.src, alt: i.alt })), null, 2)}

CTA LINKS:
${JSON.stringify(scraped.links, null, 2)}

SECTIONS (with roles):
${JSON.stringify(sections, null, 2)}

Direct this into a scene-script v2 JSON object now. Output JSON only.`;
}

export interface DirectOptions {
  scraped: ScrapedSite;
  preGate: PreGate;
  /** Max validation retries before giving up. */
  maxRetries?: number;
  /** Critic feedback to incorporate into a revision (optional). */
  criticFeedback?: string;
  /** A prior script to revise, when criticFeedback is present. */
  priorScript?: SceneScript;
}

export async function direct(opts: DirectOptions): Promise<SceneScript> {
  const maxRetries = opts.maxRetries ?? 3;
  const system = systemPrompt();
  let userPrompt = buildDirectorInput(opts.scraped, opts.preGate);

  if (opts.criticFeedback && opts.priorScript) {
    userPrompt +=
      `\n\nYou previously produced this scene script:\n` +
      "```json\n" +
      JSON.stringify(opts.priorScript, null, 2) +
      "\n```\n" +
      `A critic reviewed the rendered frames and asked for revisions:\n${opts.criticFeedback}\n` +
      `Produce a REVISED scene-script v2 JSON object addressing the feedback. Output JSON only.`;
  }

  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    log.step(`director: attempt ${attempt}/${maxRetries + 1}`);

    const prompt = lastError
      ? `${userPrompt}\n\nYour previous output FAILED schema validation with these errors:\n${lastError}\nFix every issue and output corrected JSON only.`
      : userPrompt;

    const text = await complete({
      system,
      prompt,
      maxTokens: 16000,
      effort: "high",
    });

    let raw: unknown;
    try {
      raw = extractJSON(text);
    } catch (e) {
      lastError = `Response was not valid JSON: ${(e as Error).message}`;
      log.warn(lastError);
      continue;
    }

    // Stamp generatedAt / sourceUrl defensively.
    if (raw && typeof raw === "object") {
      const obj = raw as any;
      obj.meta = obj.meta ?? {};
      obj.meta.generatedAt = new Date().toISOString();
      obj.meta.sourceUrl = obj.meta.sourceUrl || opts.scraped.url;
    }

    const result = validateSceneScript(raw);
    if (result.ok && result.data) {
      if (result.warnings.length) {
        log.warn(`director quality notes: ${result.warnings.join("; ")}`);
      }
      log.info(`director: valid scene script with ${result.data.scenes.length} scenes`);
      return result.data;
    }

    lastError = result.error ?? "unknown validation error";
    log.warn(`director: validation failed:\n${lastError}`);
  }

  throw new Error(`Director failed to produce a valid scene script after ${maxRetries + 1} attempts.\nLast error:\n${lastError}`);
}

// --- standalone CLI: npm run agent -- <runDir> <out scene-script.json> ---
// expects <runDir>/scraped.json and <runDir>/pre-gate.json to exist.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [runDir, outFile] = process.argv.slice(2);
  if (!runDir || !outFile) {
    console.error("usage: npm run agent -- <runDir> <out/scene-script.json>");
    process.exit(1);
  }
  const scraped = JSON.parse(readFileSync(join(runDir, "scraped.json"), "utf8")) as ScrapedSite;
  const preGate = JSON.parse(readFileSync(join(runDir, "pre-gate.json"), "utf8")) as PreGate;
  const script = await direct({ scraped, preGate });
  writeFileSync(outFile, JSON.stringify(script, null, 2));
  log.info(`wrote ${outFile}`);
}
