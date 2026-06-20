import { chromium, type Browser, type Page } from "playwright";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFile, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { SceneScript } from "../shared/scene-script-schema.ts";
import { totalDurationSec } from "../shared/scene-script-schema.ts";
import type { ImageInput } from "./anthropic.ts";
import { log } from "./log.ts";

/**
 * recorder.ts — loads the built site in ?recordMode=1, drives the timeline
 * deterministically via window.__setProgress(p), captures frames, and pipes
 * them to ffmpeg → cinematic.mp4.
 */

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Minimal, dependency-free static file server rooted at `dir`. */
function startStaticServer(dir: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
      if (rel === "/" || rel === "") rel = "/index.html";
      const filePath = join(dir, rel);
      if (!filePath.startsWith(dir)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end("not found");
          return;
        }
        res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function writeToStream(stream: NodeJS.WritableStream, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(buf, (err) => (err ? reject(err) : undefined));
    // Respect backpressure: resolve on drain if needed.
    if ((stream as any).writableNeedDrain) {
      stream.once("drain", resolve);
    } else {
      resolve();
    }
  });
}

export interface RecordCommonOptions {
  /** Either a built site directory (recorder serves it)… */
  dir?: string;
  /** …or an already-running URL to load. */
  url?: string;
  width?: number;
  height?: number;
}

async function openRenderer(
  opts: RecordCommonOptions,
): Promise<{ browser: Browser; page: Page; server: Server | null; baseUrl: string }> {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;

  let baseUrl = opts.url ?? "";
  let server: Server | null = null;
  if (!baseUrl) {
    if (!opts.dir) throw new Error("recorder needs either --dir or --url");
    const started = await startStaticServer(opts.dir);
    server = started.server;
    baseUrl = `http://127.0.0.1:${started.port}/`;
  }

  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const recordUrl = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "recordMode=1";
  await page.goto(recordUrl, { waitUntil: "networkidle", timeout: 60_000 });
  // Wait for the renderer to signal it has mounted, loaded images, and built the timeline.
  await page.waitForFunction(() => (window as any).__cinematicReady === true, { timeout: 60_000 });

  return { browser, page, server, baseUrl };
}

/** Capture `count` PNG frames evenly across the film, for the critic. */
export async function capturePreviewFrames(
  opts: RecordCommonOptions & { count?: number },
): Promise<ImageInput[]> {
  const count = opts.count ?? 5;
  const { browser, page, server } = await openRenderer(opts);
  const frames: ImageInput[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const p = count === 1 ? 0.5 : i / (count - 1);
      await page.evaluate((prog) => (window as any).__setProgress(prog), p);
      await page.waitForTimeout(120);
      const buf = await page.screenshot({ type: "png" });
      frames.push({ mediaType: "image/png", dataBase64: Buffer.from(buf).toString("base64") });
    }
  } finally {
    await browser.close();
    server?.close();
  }
  log.info(`captured ${frames.length} preview frames`);
  return frames;
}

export interface RecordOptions extends RecordCommonOptions {
  script: SceneScript;
  out: string;
  fps?: number;
  /** Optional audio track path to mux in. */
  audio?: string;
}

/** Render the full film to MP4. */
export async function record(opts: RecordOptions): Promise<string> {
  const fps = opts.fps ?? 30;
  const duration = totalDurationSec(opts.script);
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;

  log.step(
    `recording ${duration}s @ ${fps}fps = ${totalFrames} frames at ${width}x${height}`,
  );

  const ffmpegArgs = [
    "-y",
    "-f", "image2pipe",
    "-vcodec", "png",
    "-framerate", String(fps),
    "-i", "-",
  ];
  if (opts.audio && existsSync(opts.audio)) {
    ffmpegArgs.push("-i", opts.audio, "-c:a", "aac", "-b:a", "192k", "-shortest");
  }
  ffmpegArgs.push(
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    "-movflags", "+faststart",
    opts.out,
  );

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });
  const ffmpegDone = new Promise<void>((resolve, reject) => {
    ffmpeg.on("error", (e) =>
      reject(new Error(`ffmpeg failed to start (is it installed?): ${e.message}`)),
    );
    ffmpeg.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)),
    );
  });

  const { browser, page, server } = await openRenderer({ ...opts, width, height });
  try {
    for (let i = 0; i < totalFrames; i++) {
      const p = totalFrames === 1 ? 0 : i / (totalFrames - 1);
      await page.evaluate((prog) => (window as any).__setProgress(prog), p);
      const buf = await page.screenshot({ type: "png" });
      await writeToStream(ffmpeg.stdin, Buffer.from(buf));
      if (i % fps === 0) log.info(`  frame ${i}/${totalFrames}`);
    }
  } finally {
    ffmpeg.stdin.end();
    await browser.close();
    server?.close();
  }

  await ffmpegDone;
  log.info(`wrote ${opts.out}`);
  return opts.out;
}

// --- standalone CLI ---
// npm run record -- --dir <site> --script <scene-script.json> --out <out.mp4> [--fps 30] [--width 1920] [--height 1080] [--audio track.mp3] [--url http://...]
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const scriptPath = flag("script");
  const out = flag("out");
  if (!scriptPath || !out) {
    console.error(
      "usage: npm run record -- --dir <site> --script <scene-script.json> --out <out.mp4> [--fps 30] [--width 1920] [--height 1080] [--audio track.mp3] [--url URL]",
    );
    process.exit(1);
  }
  const script = JSON.parse(readFileSync(scriptPath, "utf8")) as SceneScript;
  await record({
    script,
    out,
    dir: flag("dir"),
    url: flag("url"),
    fps: flag("fps") ? Number(flag("fps")) : undefined,
    width: flag("width") ? Number(flag("width")) : undefined,
    height: flag("height") ? Number(flag("height")) : undefined,
    audio: flag("audio"),
  });
}
