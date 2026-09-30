import { z } from "zod";
import { SceneScript, type SceneScript as SceneScriptT } from "../shared/scene-script-schema.ts";

/**
 * validator.ts — Zod parse + quality gate + asset healing.
 *
 * The director (Claude) produces JSON. This module turns that JSON into a
 * trusted, renderable SceneScript or a precise error string the retry loop can
 * feed back to the model.
 */

export interface ValidationResult {
  ok: boolean;
  data?: SceneScriptT;
  /** Human/LLM-readable error text, suitable to feed back to the director. */
  error?: string;
  /** Non-fatal quality-gate notes. */
  warnings: string[];
}

/** Format a ZodError into compact, LLM-friendly lines. */
function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const path = i.path.length ? i.path.join(".") : "(root)";
      return `- at ${path}: ${i.message}`;
    })
    .join("\n");
}

/**
 * Asset healing: strip references to assets that don't exist (or have empty
 * URLs) so a single bad image reference doesn't sink the whole script. Operates
 * on the raw parsed object BEFORE schema validation. Mutates a clone.
 */
export function healAssets(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = JSON.parse(JSON.stringify(raw)) as Record<string, any>;

  const assets: any[] = Array.isArray(obj.assets) ? obj.assets : [];
  // Drop assets with no usable url.
  obj.assets = assets.filter((a) => a && typeof a.url === "string" && a.url.trim().length > 0);
  const validIds = new Set<string>(obj.assets.map((a: any) => String(a.id)));

  const scenes: any[] = Array.isArray(obj.scenes) ? obj.scenes : [];
  for (const s of scenes) {
    if (!s || typeof s !== "object") continue;
    if (s.type === "hero" && s.backgroundAssetId && !validIds.has(String(s.backgroundAssetId))) {
      delete s.backgroundAssetId;
    }
    if (s.type === "parallax_reveal" && Array.isArray(s.layers)) {
      for (const layer of s.layers) {
        if (layer && layer.assetId && !validIds.has(String(layer.assetId))) {
          delete layer.assetId;
        }
      }
    }
  }
  return obj;
}

/**
 * Quality gate: soft checks that don't block rendering but signal a weak
 * script. Returns warning strings.
 */
function qualityGate(script: SceneScriptT): string[] {
  const warnings: string[] = [];

  if (script.scenes.length < 2) {
    warnings.push("only one scene — cinematic pacing usually wants 3+");
  }
  if (!script.scenes.some((s) => s.type === "hero")) {
    warnings.push("no hero scene — most sites open on a hero");
  }
  if (!script.scenes.some((s) => s.type === "cta")) {
    warnings.push("no cta scene — the film has no closing call to action");
  }
  for (const s of script.scenes) {
    if (s.copy.headline.length < 3) {
      warnings.push(`scene "${s.id}" has a near-empty headline`);
    }
  }
  return warnings;
}

/** Heal, then validate, then quality-gate. */
export function validateSceneScript(raw: unknown): ValidationResult {
  const healed = healAssets(raw);
  const parsed = SceneScript.safeParse(healed);
  if (!parsed.success) {
    return {
      ok: false,
      error: formatZodError(parsed.error),
      warnings: [],
    };
  }
  return {
    ok: true,
    data: parsed.data,
    warnings: qualityGate(parsed.data),
  };
}
