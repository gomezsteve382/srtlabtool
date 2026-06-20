import { useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  type SceneScript,
  type Scene,
  type Asset,
  scrollHeightFor,
  totalDurationSec,
} from "../shared/scene-script-schema.ts";
import { SceneContent, type SceneContext } from "./scenes.tsx";
import { isRecordMode, waitForAssets, signalReady } from "./recordMode.ts";

gsap.registerPlugin(ScrollTrigger);

/**
 * SceneRenderer.tsx — top-level renderer with scene dispatch + the scroll-driven
 * GSAP master timeline (the backbone). Each scene is a fixed full-viewport layer;
 * the master timeline cross-fades between them and animates each scene's camera
 * (CSS perspective translateZ + scale) and parallax layers.
 *
 * Live mode: Lenis smooth scroll drives ScrollTrigger which scrubs the timeline.
 * Record mode: Lenis/ScrollTrigger are bypassed; window.__setProgress(p) scrubs
 * the timeline directly for frame-perfect determinism.
 */

const FX_NONE = { bloom: 0, grain: 0, vignette: 0, dof: 0 };

function cameraVars(c: { x: number; y: number; z: number; scale: number }) {
  return {
    "--cam-x": c.x,
    "--cam-y": c.y,
    "--cam-z": c.z,
    "--cam-s": c.scale,
  } as gsap.TweenVars;
}

/** Apply a scene's in-transition as an extra tween at `at` seconds. */
function transitionIn(
  tl: gsap.core.Timeline,
  content: Element,
  kind: Scene["transition"]["in"],
  at: number,
  dur: number,
) {
  switch (kind) {
    case "slide-up":
      tl.fromTo(content, { yPercent: 6 }, { yPercent: 0, duration: dur, ease: "power2.out" }, at);
      break;
    case "slide-left":
      tl.fromTo(content, { xPercent: 8 }, { xPercent: 0, duration: dur, ease: "power2.out" }, at);
      break;
    case "scale-in":
      tl.fromTo(content, { scale: 0.92 }, { scale: 1, duration: dur, ease: "power2.out" }, at);
      break;
    case "blur-in":
      tl.fromTo(
        content,
        { filter: "blur(14px)" },
        { filter: "blur(0px)", duration: dur, ease: "power2.out" },
        at,
      );
      break;
    case "fade":
    case "none":
    default:
      break; // autoAlpha tween handles fade
  }
}

export default function SceneRenderer({ script }: { script: SceneScript }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const cameraRefs = useRef<(HTMLElement | null)[]>([]);

  const ctx: SceneContext = useMemo(() => {
    const assets = new Map<string, Asset>();
    for (const a of script.assets) assets.set(a.id, a);
    return { assets, palette: script.palette };
  }, [script]);

  useLayoutEffect(() => {
    const scenes = sceneRefs.current;
    const cameras = cameraRefs.current;
    const tl = gsap.timeline({ paused: true });

    let cursor = 0;
    script.scenes.forEach((scene, i) => {
      const sec = scenes[i];
      const cam = cameras[i];
      if (!sec || !cam) return;
      const content = sec.querySelector(".scene-content");
      const dur = scene.durationSec;
      const inDur = Math.min(dur * 0.25, 1.4);
      const outDur = Math.min(dur * 0.25, 1.2);
      const isLast = i === script.scenes.length - 1;

      // initial state
      gsap.set(sec, { autoAlpha: 0 });
      gsap.set(cam, cameraVars(scene.camera.from));

      // camera move across the whole scene
      tl.to(cam, { ...cameraVars(scene.camera.to), duration: dur, ease: scene.camera.easing }, cursor);

      // fade in
      tl.to(sec, { autoAlpha: 1, duration: inDur, ease: "power1.out" }, cursor);
      if (content) transitionIn(tl, content, scene.transition.in, cursor, inDur);

      // fade out (keep the final scene on screen)
      if (!isLast) {
        tl.to(sec, { autoAlpha: 0, duration: outDur, ease: "power1.in" }, cursor + dur - outDur);
      }

      // parallax layers within the scene
      const layers = sec.querySelectorAll<HTMLElement>(".parallax-layer");
      layers.forEach((layer) => {
        const depth = Number(layer.getAttribute("data-depth") ?? "0");
        const travel = depth * 14;
        gsap.set(layer, { yPercent: travel });
        tl.to(layer, { yPercent: -travel, duration: dur, ease: "none" }, cursor);
      });

      cursor += dur;
    });

    const duration = totalDurationSec(script);
    const clamp = (p: number) => Math.max(0, Math.min(1, p));
    // Always expose a programmatic scrubber.
    window.__setProgress = (p: number) => tl.progress(clamp(p));

    let lenis: Lenis | null = null;
    let st: ScrollTrigger | null = null;
    let rafId = 0;

    if (isRecordMode()) {
      document.body.style.overflow = "hidden";
      tl.progress(0);
    } else {
      // Live mode: tall spacer creates scroll range; Lenis smooths it;
      // ScrollTrigger scrubs the master timeline.
      if (spacerRef.current) {
        spacerRef.current.style.height = `${scrollHeightFor(script) + window.innerHeight}px`;
      }
      lenis = new Lenis();
      const raf = (time: number) => {
        lenis!.raf(time);
        ScrollTrigger.update();
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
      st = ScrollTrigger.create({
        trigger: spacerRef.current!,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
        onUpdate: (self) => tl.progress(self.progress),
      });
    }

    // Preload assets, then signal readiness (record mode depends on this).
    const urls = script.assets.map((a) => a.url);
    void waitForAssets(urls).then(() => signalReady(duration));

    return () => {
      tl.kill();
      st?.kill();
      if (rafId) cancelAnimationFrame(rafId);
      lenis?.destroy();
      window.__cinematicReady = false;
    };
  }, [script]);

  return (
    <div
      ref={rootRef}
      className="cinematic-root"
      style={
        {
          "--bg": script.palette.background,
          "--fg": script.palette.foreground,
          "--accent": script.palette.accent,
          "--muted": script.palette.muted,
        } as React.CSSProperties
      }
    >
      {script.scenes.map((scene, i) => {
        const fx = { ...FX_NONE, ...(scene.effects ?? {}) };
        const override = scene.paletteOverride ?? {};
        return (
          <section
            key={scene.id}
            className={`scene scene-${scene.type}`}
            ref={(el) => (sceneRefs.current[i] = el)}
            style={
              {
                ...(override.background ? { "--bg": override.background } : {}),
                ...(override.foreground ? { "--fg": override.foreground } : {}),
                ...(override.accent ? { "--accent": override.accent } : {}),
                ...(override.muted ? { "--muted": override.muted } : {}),
              } as React.CSSProperties
            }
          >
            <div
              className="scene-camera"
              ref={(el) => (cameraRefs.current[i] = el)}
              style={{ filter: fx.dof ? `blur(${fx.dof * 6}px)` : undefined }}
            >
              <SceneContent scene={scene} ctx={ctx} />
            </div>
            {/* effect overlays — static intensities from the scene */}
            {fx.vignette > 0 && (
              <div className="fx-vignette" style={{ opacity: fx.vignette }} />
            )}
            {fx.grain > 0 && <div className="fx-grain" style={{ opacity: fx.grain }} />}
            {fx.bloom > 0 && (
              <div className="fx-bloom" style={{ opacity: fx.bloom * 0.6 }} />
            )}
          </section>
        );
      })}
      {/* Scroll spacer (live mode only; height set imperatively). */}
      <div ref={spacerRef} className="scroll-spacer" aria-hidden />
    </div>
  );
}
