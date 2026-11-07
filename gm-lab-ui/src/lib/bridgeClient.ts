/* ============================================================================
 * bridgeClient.ts — GM LAB's client for the estate J2534 HTTP bridge daemon
 * (j2534_bridge.py on http://127.0.0.1:8765). TS port of the srt-lab twin's
 * bridgeClient.js patterns, carrying the estate's hard-won laws verbatim:
 *
 *  • FLAGS:0 LAW — a raw 11-bit TX MUST pass flags:0 explicitly; the daemon's
 *    `extended` default (29-bit) silently kills 11-bit traffic with
 *    ERR_INVALID_MSG (banked across the FCA campaign; identical on this lane).
 *  • The ONE shared VCI channel: iso15765 vs raw are mutually exclusive —
 *    "Channel is in iso15765 mode" means another client (the SRT Lab app)
 *    holds the channel; recovery = /disconnect → /close → /open → /connect.
 *  • TX-echo discard: sendmsg/readmsg pairs read our own echo first.
 *  • closeCode threading: the daemon classifies failures ({closeCode,
 *    closeClass, retryable, friendly}) — pass through untouched.
 * ========================================================================== */

export const DEFAULT_BRIDGE_URL = 'http://localhost:8765';

const LS_KEY = 'gmlab_bridge';

export interface BridgeConfig {
  url: string;
  autoOpen: boolean;
}

export function getBridgeConfig(): BridgeConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { url: DEFAULT_BRIDGE_URL, autoOpen: true };
    return { url: DEFAULT_BRIDGE_URL, autoOpen: true, ...JSON.parse(raw) };
  } catch {
    return { url: DEFAULT_BRIDGE_URL, autoOpen: true };
  }
}

export function setBridgeConfig(patch: Partial<BridgeConfig>): BridgeConfig {
  try {
    const next = { ...getBridgeConfig(), ...patch };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getBridgeConfig();
  }
}

/* ─── HTTP helper ─────────────────────────────────────────────────────────── */

function trimUrl(u: string): string {
  return (u || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
}

export interface BridgeResult {
  ok: boolean;
  error?: string;
  closeCode?: string | number;
  closeClass?: string;
  retryable?: boolean;
  friendly?: string;
  [k: string]: unknown;
}

async function call(
  url: string,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body: unknown = null,
  timeoutMs = 4000,
): Promise<BridgeResult> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(trimUrl(url) + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let json: BridgeResult;
    try {
      json = text
        ? (JSON.parse(text) as BridgeResult)
        : res.ok
          ? { ok: true }
          : { ok: false, error: 'HTTP ' + res.status };
    } catch {
      json = { ok: false, error: 'non-JSON: ' + text.slice(0, 120) };
    }
    if (!res.ok && json.ok !== false) json.ok = false;
    if (!res.ok && !json.error) json.error = 'HTTP ' + res.status;
    return json;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        ok: false,
        error: 'Bridge timed out (is the bridge daemon running?)',
        closeCode: 'CLIENT_ABORT',
        closeClass: 'TRANSIENT',
        retryable: true,
        friendly: 'The request to the bridge daemon timed out — it may be busy or not running.',
      };
    }
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(tm);
  }
}

/* ─── Core bridge endpoints ───────────────────────────────────────────────── */

export const status = (url: string) => call(url, '/status', 'GET');
export const openDevice = (url: string) => call(url, '/open', 'POST', {});
export const closeDevice = (url: string) => call(url, '/close', 'POST', {});
export const disconnect = (url: string) => call(url, '/disconnect', 'POST', {});
export const voltage = (url: string) => call(url, '/voltage', 'POST', {}, 2000);

/** Classic ISO15765 connect (protocol 6) — the field-proven diagnostic lane. */
export function connect(
  url: string,
  opts: { baudrate?: number; protocol?: number; flags?: number } = {},
): Promise<BridgeResult> {
  return call(url, '/connect', 'POST', { baudrate: 500000, protocol: 6, ...opts });
}

/** RAW-CAN connect. flags:0 is the LAW for 11-bit — never let it default. */
export function connectRaw(
  url: string,
  opts: { baudrate?: number; flags?: number; openFilter?: boolean } = {},
): Promise<BridgeResult> {
  return call(url, '/connect_raw', 'POST', { baudrate: 500000, flags: 0, ...opts });
}

export function setFilter(
  url: string,
  opts: { txId: number; rxId: number },
): Promise<BridgeResult> {
  return call(url, '/setfilter', 'POST', opts);
}

export function sendMsg(
  url: string,
  opts: { txId: number; data: string; timeoutMs?: number; flags?: number },
): Promise<BridgeResult> {
  return call(url, '/sendmsg', 'POST', { timeoutMs: 1000, ...opts });
}

export function readMsg(
  url: string,
  opts: { timeoutMs?: number; maxMsgs?: number } = {},
): Promise<BridgeResult> {
  return call(url, '/readmsg', 'POST', { timeoutMs: 1000, ...opts });
}

/* ─── UDS exchange (the diagnostic workhorse) ─────────────────────────────── */

const hexOf = (m: unknown): string => {
  if (m && typeof m === 'object') {
    const o = m as Record<string, unknown>;
    for (const k of ['data', 'Data', 'payload', 'bytes']) {
      const v = o[k];
      if (Array.isArray(v)) return v.map((b) => (Number(b) & 0xff).toString(16).padStart(2, '0')).join('');
      if (typeof v === 'string') return v.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    }
  }
  if (typeof m === 'string') return m.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return '';
};

export interface BridgeClient {
  url: string;
  connectClassic(baudrate?: number): Promise<BridgeResult>;
  udsExchange(txId: number, rxId: number, payloadHex: string, timeoutMs?: number): Promise<string>;
  disconnect(): Promise<BridgeResult>;
}

/** One diagnostic client bound to a bridge URL (stateless lane helpers). */
export function createBridgeClient(url: string): BridgeClient {
  return {
    url,
    async connectClassic(baudrate = 500000) {
      await disconnect(url);
      return connect(url, { baudrate });
    },
    async udsExchange(txId, rxId, payloadHex, timeoutMs = 3000): Promise<string> {
      await setFilter(url, { txId, rxId });
      await sendMsg(url, { txId, data: payloadHex, timeoutMs });
      await readMsg(url, { timeoutMs: 500, maxMsgs: 1 }); // discard TX echo (banked law)
      const rx = await readMsg(url, { timeoutMs, maxMsgs: 1 });
      if (!rx.ok) return '';
      return hexOf(rx.msg ?? rx);
    },
    async disconnect() {
      return disconnect(url);
    },
  };
}

/* ─── React status hook (mirrors the twin's useBridgeStatus) ──────────────── */

import { useEffect, useState } from 'react';

export interface BridgeStatus {
  probed: boolean;
  ok: boolean;
  voltage?: string | number;
  raw?: BridgeResult;
}

export function useBridgeStatus(intervalMs = 4000, url?: string): BridgeStatus & { url: string } {
  const cfg = url ?? getBridgeConfig().url;
  const [st, setSt] = useState<BridgeStatus>({ probed: false, ok: false });
  useEffect(() => {
    let live = true;
    const probe = async () => {
      const r = await status(cfg);
      const v = await voltage(cfg).catch(() => null);
      if (!live) return;
      setSt({
        probed: true,
        ok: !!r.ok,
        voltage: v && v.ok !== false ? ((v as { voltage?: string | number }).voltage ?? undefined) : undefined,
        raw: r,
      });
    };
    void probe();
    const t = setInterval(probe, intervalMs);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [cfg, intervalMs]);
  return { ...st, url: cfg };
}
