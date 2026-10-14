import { z } from "zod";

/**
 * scene-script-schema.ts — THE CONTRACT.
 *
 * This is the single source of truth between the director (agent.ts) and the
 * renderer (SceneRenderer.tsx / scenes.tsx). It is shared by both the Node
 * pipeline and the browser bundle, so it must not import anything Node- or
 * DOM-specific.
 *
 * v2 deliberately ships ONLY 4 scene types. Do not reintroduce the old 11.
 */

// The constant that maps scene duration → scroll distance. The renderer and the
// recorder both depend on this being identical. Changing it changes the pacing
// of every render.
export const SCROLL_PX_PER_SEC = 320;

// Hard timing bounds (seconds).
export const MIN_SCENE_SEC = 2;
export const MAX_SCENE_SEC = 14;
export const MIN_TOTAL_SEC = 6;
export const MAX_TOTAL_SEC = 110;

export const MOODS = [
  "energetic",
  "elegant",
  "playful",
  "minimal",
  "dramatic",
  "warm",
  "corporate",
] as const;

export const SCENE_TYPES = ["hero", "parallax_reveal", "stats_grid", "cta"] as const;

const EASINGS = [
  "none",
  "power1.inOut",
  "power2.out",
  "power3.inOut",
  "expo.out",
  "sine.inOut",
] as const;

const TRANSITIONS = ["none", "fade", "slide-up", "slide-left", "scale-in", "blur-in"] as const;

const ASSET_ROLES = ["hero", "feature", "testimonial", "cta", "background", "logo"] as const;

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "must be a 6-digit hex color like #1a2b3c");

const Palette = z.object({
  background: hex,
  foreground: hex,
  accent: hex,
  muted: hex,
});
export type Palette = z.infer<typeof Palette>;

const PaletteOverride = Palette.partial();

const CameraState = z.object({
  // Lateral / vertical offset in viewport-percent units. 0 = centered.
  x: z.number().min(-120).max(120).default(0),
  y: z.number().min(-120).max(120).default(0),
  // CSS scale. 1 = neutral. >1 pushes "in".
  scale: z.number().min(0.4).max(3).default(1),
  // translateZ depth in px (CSS perspective). Negative = further away.
  z: z.number().min(-3000).max(2000).default(0),
});
export type CameraState = z.infer<typeof CameraState>;

const Camera = z.object({
  from: CameraState,
  to: CameraState,
  easing: z.enum(EASINGS).default("power2.out"),
});

const Transition = z.object({
  in: z.enum(TRANSITIONS).default("fade"),
  out: z.enum(TRANSITIONS).default("fade"),
});

const Effects = z
  .object({
    bloom: z.number().min(0).max(1).default(0),
    grain: z.number().min(0).max(1).default(0),
    vignette: z.number().min(0).max(1).default(0),
    dof: z.number().min(0).max(1).default(0),
  })
  .partial()
  .default({});

const Copy = z.object({
  eyebrow: z.string().max(60).optional(),
  headline: z.string().min(1).max(160),
  subhead: z.string().max(220).optional(),
  body: z.string().max(600).optional(),
});

const Asset = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  alt: z.string().optional(),
  role: z.enum(ASSET_ROLES).optional(),
});
export type Asset = z.infer<typeof Asset>;

// Common fields shared by every scene variant.
const SceneBase = z.object({
  id: z.string().min(1),
  durationSec: z.number().min(MIN_SCENE_SEC).max(MAX_SCENE_SEC),
  copy: Copy,
  paletteOverride: PaletteOverride.optional(),
  camera: Camera,
  transition: Transition,
  effects: Effects,
});

const HeroScene = SceneBase.extend({
  type: z.literal("hero"),
  backgroundAssetId: z.string().optional(),
  // 0 = flat, 1 = deep parallax on the background.
  depth: z.number().min(0).max(1).default(0.5),
});

const ParallaxLayer = z.object({
  assetId: z.string().optional(),
  // 0 = locked to camera, 1 = max parallax travel.
  depth: z.number().min(0).max(1),
  caption: z.string().max(120).optional(),
});

const ParallaxScene = SceneBase.extend({
  type: z.literal("parallax_reveal"),
  layers: z.array(ParallaxLayer).min(1).max(4),
});

const Stat = z.object({
  value: z.string().min(1).max(24),
  label: z.string().min(1).max(60),
});

const StatsScene = SceneBase.extend({
  type: z.literal("stats_grid"),
  stats: z.array(Stat).min(2).max(6),
});

const CtaScene = SceneBase.extend({
  type: z.literal("cta"),
  buttonLabel: z.string().min(1).max(40),
  href: z.string().optional(),
});

export const Scene = z.discriminatedUnion("type", [
  HeroScene,
  ParallaxScene,
  StatsScene,
  CtaScene,
]);
export type Scene = z.infer<typeof Scene>;

export const SceneScript = z
  .object({
    version: z.literal("2"),
    meta: z.object({
      sourceUrl: z.string(),
      title: z.string(),
      mood: z.enum(MOODS),
      generatedAt: z.string().optional(),
    }),
    palette: Palette,
    assets: z.array(Asset).default([]),
    audio: z
      .object({
        track: z.string(),
        mood: z.string(),
      })
      .optional(),
    scenes: z.array(Scene).min(1).max(8),
  })
  .superRefine((data, ctx) => {
    // --- unique ids ---
    const sceneIds = new Set<string>();
    for (const s of data.scenes) {
      if (sceneIds.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate scene id "${s.id}"`,
          path: ["scenes"],
        });
      }
      sceneIds.add(s.id);
    }

    const assetIds = new Set<string>();
    for (const a of data.assets) {
      if (assetIds.has(a.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate asset id "${a.id}"`,
          path: ["assets"],
        });
      }
      assetIds.add(a.id);
    }

    // --- referenced assets must exist ---
    const refs: Array<{ id: string; path: (string | number)[] }> = [];
    data.scenes.forEach((s, i) => {
      if (s.type === "hero" && s.backgroundAssetId) {
        refs.push({ id: s.backgroundAssetId, path: ["scenes", i, "backgroundAssetId"] });
      }
      if (s.type === "parallax_reveal") {
        s.layers.forEach((l, j) => {
          if (l.assetId) refs.push({ id: l.assetId, path: ["scenes", i, "layers", j, "assetId"] });
        });
      }
    });
    for (const ref of refs) {
      if (!assetIds.has(ref.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `scene references unknown assetId "${ref.id}" — it must exist in assets[]`,
          path: ref.path,
        });
      }
    }

    // --- total duration bounds (duration ↔ scroll distance consistency) ---
    const total = data.scenes.reduce((sum, s) => sum + s.durationSec, 0);
    if (total < MIN_TOTAL_SEC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `total duration ${total}s is below the ${MIN_TOTAL_SEC}s minimum`,
        path: ["scenes"],
      });
    }
    if (total > MAX_TOTAL_SEC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `total duration ${total}s exceeds the ${MAX_TOTAL_SEC}s maximum`,
        path: ["scenes"],
      });
    }
  });

export type SceneScript = z.infer<typeof SceneScript>;

/** Total runtime of the script in seconds. */
export function totalDurationSec(script: SceneScript): number {
  return script.scenes.reduce((sum, s) => sum + s.durationSec, 0);
}

/** Total scroll height the renderer must produce for this script (in px). */
export function scrollHeightFor(script: SceneScript): number {
  return Math.round(totalDurationSec(script) * SCROLL_PX_PER_SEC);
}
