import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { complete, extractJSON } from "./anthropic.ts";
import { MOODS } from "../shared/scene-script-schema.ts";
import type { ScrapedSite, PreGate, TreatmentLevel } from "../shared/scraped-types.ts";
import { log } from "./log.ts";

/**
 * pre-gate.ts — a Claude call that scores whether a site is worth the cinematic
 * treatment, picks a mood, emits a treatment level, and classifies section
 * roles (hero/feature/testimonial/cta). Section roles are decided by the model,
 * NOT regex.
 */

const SYSTEM = `You are the pre-gate for a cinematic website-to-film pipeline.
Given structured data scraped from a website plus a screenshot, you decide:

1. score (0-100): how much cinematic treatment would benefit this site. High for
   brand/marketing/portfolio/product sites with strong copy and imagery; low for
   bare utility pages, error pages, or content-thin sites.
2. mood: one of ${MOODS.join(", ")}.
3. treatment: "full" (score >= 55), "minimal" (25-54), or "skip" (< 25).
4. reasoning: one or two sentences.
5. sectionRoles: classify each provided section index as one of
   hero | feature | testimonial | cta | content | footer. Use the copy and order
   to decide — do not pattern-match on keywords alone.

Respond with ONLY a JSON object of this exact shape, no prose, no code fences:
{
  "score": number,
  "mood": string,
  "treatment": "full" | "minimal" | "skip",
  "reasoning": string,
  "sectionRoles": [{ "index": number, "role": string }]
}`;

export async function preGate(scraped: ScrapedSite, runDir: string): Promise<PreGate> {
  log.step("pre-gate: scoring worthiness + mood + section roles");

  const compactSections = scraped.sections.map((s) => ({
    index: s.index,
    heading: s.heading,
    text: s.text.slice(0, 280),
  }));

  const prompt = `SITE: ${scraped.url}
TITLE: ${scraped.title}
DESCRIPTION: ${scraped.description}
PALETTE HINTS: ${scraped.paletteHints.join(", ")}
HEADINGS: ${scraped.headings.slice(0, 12).join(" | ")}
IMAGE COUNT: ${scraped.images.length}
CTA LINKS: ${scraped.links.map((l) => l.text).join(", ") || "(none)"}

SECTIONS:
${JSON.stringify(compactSections, null, 2)}

The attached image is the above-the-fold screenshot. Score it.`;

  const images = [];
  const shotPath = join(runDir, scraped.screenshots.viewport);
  if (existsSync(shotPath)) {
    images.push({ mediaType: "image/png", dataBase64: readFileSync(shotPath).toString("base64") });
  }

  const text = await complete({
    system: SYSTEM,
    prompt,
    images,
    maxTokens: 4000,
    effort: "medium",
  });

  const raw = extractJSON<Partial<PreGate>>(text);

  const treatment: TreatmentLevel =
    raw.treatment === "full" || raw.treatment === "minimal" || raw.treatment === "skip"
      ? raw.treatment
      : (raw.score ?? 0) >= 55
        ? "full"
        : (raw.score ?? 0) >= 25
          ? "minimal"
          : "skip";

  const result: PreGate = {
    score: Math.max(0, Math.min(100, Math.round(raw.score ?? 0))),
    mood: (MOODS as readonly string[]).includes(raw.mood ?? "") ? raw.mood! : "elegant",
    treatment,
    reasoning: raw.reasoning ?? "",
    sectionRoles: Array.isArray(raw.sectionRoles) ? raw.sectionRoles : [],
  };

  log.info(
    `pre-gate: score=${result.score} mood=${result.mood} treatment=${result.treatment}`,
  );
  return result;
}

// --- standalone CLI: npm run pre-gate -- <scraped.json> <out pre-gate.json> ---
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const [scrapedFile, outFile] = process.argv.slice(2);
  if (!scrapedFile || !outFile) {
    console.error("usage: npm run pre-gate -- <scraped.json> <out/pre-gate.json>");
    process.exit(1);
  }
  const scraped = JSON.parse(readFileSync(scrapedFile, "utf8")) as ScrapedSite;
  const result = await preGate(scraped, dirname(scrapedFile));
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  log.info(`wrote ${outFile}`);
}
