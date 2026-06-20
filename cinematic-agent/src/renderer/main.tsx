import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SceneRenderer from "./SceneRenderer.tsx";
import { SceneScript } from "../shared/scene-script-schema.ts";
import "./index.css";

/**
 * main.tsx — Vite entry. Fetches ./scene-script.json (placed next to index.html
 * by the build step), validates it with the shared Zod schema, and mounts the
 * renderer. Validating here too keeps the live site honest about the contract.
 */

async function boot() {
  const rootEl = document.getElementById("root")!;
  try {
    const res = await fetch("./scene-script.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`scene-script.json not found (${res.status})`);
    const raw = await res.json();
    const parsed = SceneScript.safeParse(raw);
    if (!parsed.success) {
      throw new Error("scene-script.json failed schema validation:\n" + parsed.error.toString());
    }
    createRoot(rootEl).render(
      <StrictMode>
        <SceneRenderer script={parsed.data} />
      </StrictMode>,
    );
  } catch (e) {
    rootEl.innerHTML = `<pre style="color:#f5f3ee;background:#0a0a0c;padding:2rem;font-family:monospace;white-space:pre-wrap">Cinematic renderer failed to load:\n\n${
      e instanceof Error ? e.message : String(e)
    }</pre>`;
    // Still signal readiness so the recorder doesn't hang forever on a bad
    // script — and provide a no-op scrubber + zero duration so the recorder can
    // fail fast in a controlled way instead of throwing on a missing function.
    window.__setProgress = () => {};
    window.__duration = 0;
    window.__cinematicReady = true;
  }
}

void boot();
