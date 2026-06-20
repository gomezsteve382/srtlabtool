import { motion } from "framer-motion";
import type { Scene, Asset, Palette } from "../shared/scene-script-schema.ts";

/**
 * scenes.tsx — the 4 v2 scene components (hero, parallax_reveal, stats_grid,
 * cta) plus a dispatcher. These render content INTO a camera wrapper that
 * SceneRenderer animates; they don't own the camera/timeline themselves.
 *
 * Do not reintroduce the old 11 scene types or R3F.
 */

export interface SceneContext {
  assets: Map<string, Asset>;
  palette: Palette;
}

function assetUrl(ctx: SceneContext, id?: string): string | undefined {
  if (!id) return undefined;
  return ctx.assets.get(id)?.url;
}

/** Animated copy block shared by scenes. */
function CopyBlock({ scene }: { scene: Scene }) {
  const { eyebrow, headline, subhead, body } = scene.copy;
  return (
    <div className="copy-block">
      {eyebrow && (
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {eyebrow}
        </motion.p>
      )}
      <h1 className="headline">{headline}</h1>
      {subhead && <p className="subhead">{subhead}</p>}
      {body && <p className="body">{body}</p>}
    </div>
  );
}

function Hero({ scene, ctx }: { scene: Extract<Scene, { type: "hero" }>; ctx: SceneContext }) {
  const bg = assetUrl(ctx, scene.backgroundAssetId);
  return (
    <div className="scene-content hero-scene">
      {bg && (
        <div
          className="parallax-layer hero-bg"
          data-depth={scene.depth}
          style={{ backgroundImage: `url("${bg}")` }}
        />
      )}
      <div className="scrim" />
      <div className="hero-copy">
        <CopyBlock scene={scene} />
      </div>
    </div>
  );
}

function ParallaxReveal({
  scene,
  ctx,
}: {
  scene: Extract<Scene, { type: "parallax_reveal" }>;
  ctx: SceneContext;
}) {
  return (
    <div className="scene-content parallax-scene">
      {scene.layers.map((layer, i) => {
        const url = assetUrl(ctx, layer.assetId);
        return (
          <div key={i} className="parallax-layer parallax-card" data-depth={layer.depth}>
            {url ? (
              <img src={url} alt={layer.caption ?? ""} />
            ) : (
              <div className="parallax-placeholder" />
            )}
            {layer.caption && <span className="caption">{layer.caption}</span>}
          </div>
        );
      })}
      <div className="parallax-copy">
        <CopyBlock scene={scene} />
      </div>
    </div>
  );
}

function StatsGrid({
  scene,
}: {
  scene: Extract<Scene, { type: "stats_grid" }>;
}) {
  return (
    <div className="scene-content stats-scene">
      <CopyBlock scene={scene} />
      <div className="stats-grid" data-count={scene.stats.length}>
        {scene.stats.map((s, i) => (
          <div className="stat" key={i}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cta({ scene }: { scene: Extract<Scene, { type: "cta" }> }) {
  return (
    <div className="scene-content cta-scene">
      <CopyBlock scene={scene} />
      <a className="cta-button" href={scene.href ?? "#"} onClick={(e) => e.preventDefault()}>
        {scene.buttonLabel}
      </a>
    </div>
  );
}

export function SceneContent({ scene, ctx }: { scene: Scene; ctx: SceneContext }) {
  switch (scene.type) {
    case "hero":
      return <Hero scene={scene} ctx={ctx} />;
    case "parallax_reveal":
      return <ParallaxReveal scene={scene} ctx={ctx} />;
    case "stats_grid":
      return <StatsGrid scene={scene} />;
    case "cta":
      return <Cta scene={scene} />;
  }
}
