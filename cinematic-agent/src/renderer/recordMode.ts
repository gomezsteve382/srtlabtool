/**
 * recordMode.ts — record-mode hooks.
 *
 * Record mode is activated by the `?recordMode=1` query param. In record mode:
 *   - Lenis smooth scroll is NOT initialized (SceneRenderer checks isRecordMode).
 *   - The page does not scroll; the recorder steps the timeline via
 *     window.__setProgress(p), p in 0..1.
 *   - window.__cinematicReady is set true once fonts + images are loaded and the
 *     master timeline is built, so the recorder knows it's safe to capture.
 */

declare global {
  interface Window {
    __setProgress?: (p: number) => void;
    __cinematicReady?: boolean;
    __duration?: number;
  }
}

export function isRecordMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("recordMode") === "1";
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // never block on a broken asset
    img.src = url;
  });
}

/** Wait for fonts and all referenced images before signaling readiness. */
export async function waitForAssets(urls: string[]): Promise<void> {
  const fontsReady =
    typeof document !== "undefined" && (document as any).fonts?.ready
      ? (document as any).fonts.ready
      : Promise.resolve();
  await Promise.all([fontsReady, ...urls.map(preloadImage)]);
}

export function signalReady(durationSec: number): void {
  window.__duration = durationSec;
  window.__cinematicReady = true;
}
