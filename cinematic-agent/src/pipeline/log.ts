import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Tiny logger. Prints to stdout and, when a run log path is set, mirrors every
 * line into renders/<name>/run.log.
 */

let runLogPath: string | null = null;

export function setRunLog(path: string): void {
  runLogPath = path;
  mkdirSync(dirname(path), { recursive: true });
}

function ts(): string {
  return new Date().toISOString();
}

function emit(level: string, msg: string): void {
  const line = `${ts()} [${level}] ${msg}`;
  // eslint-disable-next-line no-console
  console.log(line);
  if (runLogPath) {
    try {
      appendFileSync(runLogPath, line + "\n");
    } catch {
      /* never let logging crash the pipeline */
    }
  }
}

export const log = {
  info: (msg: string) => emit("info", msg),
  step: (msg: string) => emit("step", `▸ ${msg}`),
  warn: (msg: string) => emit("warn", msg),
  error: (msg: string) => emit("error", msg),
};
