import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the built site portable — it can be served from any path
// (e.g. renders/<name>/site/) which is what the recorder does.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
