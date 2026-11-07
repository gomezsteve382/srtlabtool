import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/* GM LAB — twin of the SRT Lab dev-server shape (PORT required for dev/preview,
 * plain static build for production). Two project-local dev plugins:
 *   gmpins  — read-only HTTP lane over the estate gm_pins.bin (8 MB stays on
 *             disk; the browser never downloads it). Lookups + pair search.
 *   spsemu  — dev-only lane to probe the local sps-emu emulator (:8443) and
 *             report its status. It NEVER starts processes on its own; START
 *             is an explicit operator action (see EMULATOR tab). */
import gmpinsLane from "./dev-plugins/gmpins.mjs";
import spsemuLane from "./dev-plugins/spsemu.mjs";

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;

if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = rawPort ? Number(rawPort) : 5199;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), gmpinsLane(), spsemuLane()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
