import { run, type Stage } from "./orchestrator.ts";

/**
 * cli.ts — entry point for `npm run run -- <url> [flags]`.
 *
 *   npm run run -- https://example.com --out ./renders/example
 *
 * Flags:
 *   --out <dir>            output run directory (default ./renders/<host>)
 *   --fps <n>             frames per second (default 30)
 *   --width <n>          (default 1920)
 *   --height <n>         (default 1080)
 *   --audio <path>      explicit soundtrack override
 *   --skip a,b,c        skip stages: scrape,pre-gate,agent,critique,build,record
 */

const argv = process.argv.slice(2);

// Allow an optional leading "run" subcommand (matches the doc's phrasing).
if (argv[0] === "run") argv.shift();

const positional: string[] = [];
const flags: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    flags[a.slice(2)] = argv[i + 1] ?? "";
    i++;
  } else {
    positional.push(a);
  }
}

const url = positional[0];
if (!url) {
  console.error("usage: npm run run -- <url> [--out dir] [--fps 30] [--width 1920] [--height 1080] [--audio track.mp3] [--skip scrape,agent]");
  process.exit(1);
}

let host = "site";
try {
  host = new URL(url).hostname.replace(/^www\./, "").replace(/\./g, "-");
} catch {
  console.error(`invalid url: ${url}`);
  process.exit(1);
}

const outDir = flags.out || `./renders/${host}`;
const skip = (flags.skip ? flags.skip.split(",") : []).map((s) => s.trim()) as Stage[];

run({
  url,
  outDir,
  fps: flags.fps ? Number(flags.fps) : undefined,
  width: flags.width ? Number(flags.width) : undefined,
  height: flags.height ? Number(flags.height) : undefined,
  audio: flags.audio || undefined,
  skip,
}).catch((e) => {
  console.error("\nPipeline failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
